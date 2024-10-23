import * as DB from 'datalogia'
import * as Store from './store/okra.js'
import { Link, Task } from 'datalogia'
import { Response } from './http.js'
import * as Session from './session.js'
import * as JSON from '@ipld/dag-json'
export * as DB from 'datalogia'

/**
 * Connects to the  service by opening the underlying store.
 *
 * @param {URL} url
 * @param {Store.Options} [options]
 * @returns {Task.Task<MutableSelf, Error>}
 */
export const open = function* (url, options) {
  const store = yield* Store.open(url, options)
  const { id } = yield* Store.status(store)
  return {
    id,
    source: store,
    sessions: new Map(),
  }
}

/**
 * Closes down the service by closing the underlying store.
 *
 * @param {MutableSelf} self
 */
export const close = function* (self) {
  yield* Store.close(self.source)
}

/**
 * @typedef {object} Self
 * @property {string} id - Current hash of the store.
 * @property {DB.API.Querier} source - The underlying data store.
 * @property {Map<string, Session.Session>} sessions - Active query sessions.
 *
 * @typedef {Self & {source: DB.API.Transactor<Store.Commit>}} MutableSelf
 */

/**
 * Decodes body of the request as DAG-JSON which unlike regular JSON supports
 * binary data and IPLD links.
 *
 * @param {Request} request
 */
const decodeBody = function* (request) {
  const buffer = yield* Task.wait(request.arrayBuffer())
  return JSON.decode(new Uint8Array(buffer))
}

/**
 * Opens a session for the query enclosed in an JSON HTTP request.
 *
 * @param {Self} self
 * @param {Request} request
 */
export const openSession = function* (self, request) {
  const { ok: query, error: parseError } = yield* Task.perform(
    decodeBody(request)
  ).result()

  if (parseError) {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Bad request payload, expected DAG-JSON',
        },
      }),
      {
        status: 400,
        statusText: 'Invalid payload',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  }

  const id = Link.of(query).toString()
  if (!self.sessions.has(id)) {
    const { ok: session, error } = yield* Task.perform(
      Session.open({
        query,
        source: self.source,
      })
    ).result()

    if (error) {
      return new Response(
        JSON.stringify({
          error: {
            message: error.message,
          },
        }),
        {
          status: 400,
          statusText: 'Invalid query',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      )
    }

    // Add the session to the list of active sessions.
    self.sessions.set(id, session)
  }

  // Redirect to the subscription URL.
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(`/${id}`, request.url).toString(),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

/**
 * Applies a transaction encoded in HTTP request as JSON and notifies all
 * the affected subscribers about the changes.
 *
 * @param {MutableSelf} self
 * @param {Request} request
 */
export const publish = function* (self, request) {
  const result = yield* Task.perform(decodeBody(request)).result()
  if (result.error) {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Bad request payload, expected JSON',
        },
      }),
      {
        status: 400,
        statusText: 'Invalid payload',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  }

  const { ok: commit, error } = yield* Task.perform(
    transact(self, result.ok)
  ).result()

  if (commit) {
    return new Response(
      JSON.encode({
        ok: {
          before: { id: commit.before.id },
          after: { id: commit.after.id },
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  } else {
    return new Response(
      JSON.encode({
        error: { message: error?.message ?? 'Transaction failed' },
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  }
}

/**
 * Subscribes to the session by opening a new event source connection and
 * adding it to the list of subscribers.
 *
 * @param {Self} self
 * @param {Request} request
 */
export const subscribe = function* (self, request) {
  // If we land on the root URL we just return an empty response.
  const url = new URL(request.url)
  if (url.pathname === '/') {
    return new Response(
      JSON.stringify({
        ok: {},
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  }

  // Otherwise we assume this is a query session URL in which case we resolve
  // the session and create a new subscription.
  const id = url.pathname.slice(1)
  const session = self.sessions.get(id)

  // If we did not find the session we return 404.
  if (!session) {
    return new Response(
      JSON.stringify({
        error: {
          message: `Subscription not found at: ${url.pathname}`,
        },
      }),
      {
        status: 404,
        statusText: 'Subscription not found',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  }

  return new Response(yield* Session.subscribe(session), {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

/**
 * Notifies all of the active session about the changes in the store.
 *
 * @param {Self} self
 */
export const notify = function* (self) {
  const pending = []
  for (const session of self.sessions.values()) {
    // We may have subscriptions without any open connections we skip those
    // as there is no point in recomputing the state for those.
    if (session.subscriber.size > 0) {
      pending.push(Task.perform(Session.notify(session)))
    }
  }

  yield* Task.wait(Promise.all(pending))
}

/**
 * @param {MutableSelf} self
 * @param {DB.API.Transaction} instructions
 */
export const transact = function* (self, instructions) {
  const commit = yield* DB.transact(self.source, instructions)
  if (commit.before.id !== commit.after.id) {
    self.id = commit.after.id
    yield* notify(self)
  }

  return commit
}
