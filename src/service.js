import * as DB from 'datalogia'
import * as Memory from './store/memory.js'
import * as Store from './store/file.js'
import { Task } from 'datalogia'
import * as Session from './session.js'
import * as JSON from '@ipld/dag-json'
export * as DB from 'datalogia'
import * as Agent from './agent.js'
import * as Reference from './datum/reference.js'
import * as Query from './agent/query.js'
import { refer, synopsys } from './agent.js'
import { toEventSource } from './agent/selection.js'
import { broadcast } from './agent/sync.js'
import * as DAG from './agent/dag.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * Connects to the  service by opening the underlying store.
 *
 * @param {URL} url
 * @param {Store.Options} [options]
 * @returns {Task.Task<MutableSelf, Error>}
 */
export const open = function* (url, options) {
  const store =
    url.protocol === 'memory:'
      ? yield* Memory.open()
      : yield* Store.open(url, options)

  const agent = yield* Agent.open({ local: { store } })
  const { id } = yield* Store.status(store)
  return {
    id,
    agent,
    source: store,
    subscriptions: new Map(),
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
 *
 * @param {MutableSelf} self
 * @param {Request} request
 */
export const request = function* (self, request) {
  switch (request.method) {
    case 'OPTIONS':
      return new Response(null, {
        status: 204,
        statusText: 'YOLO',
        headers: CORS,
      })
    case 'PUT':
      return yield* put(self, request)
    case 'PATCH':
      return yield* patch(self, request)
    case 'GET':
      return yield* get(self, request)
    default:
      return error(
        { message: 'Method not allowed' },
        { status: 405, statusText: 'Method not allowed' }
      )
  }
}

/**
 * @param {MutableSelf} self
 * @param {Request} request
 */
export function* patch(self, request) {
  const body = new Uint8Array(yield* Task.wait(request.arrayBuffer()))
  const changes = /** @type {DB.Transaction} */ (yield* DAG.decode(JSON, body))
  const commit = yield* DB.transact(self.source, changes)
  return ok({
    before: commit.before.id,
    after: commit.after.id,
  })
}

/**
 * @param {MutableSelf} self
 * @param {Request} request
 */
export function* put(self, request) {
  const body = new Uint8Array(yield* Task.wait(request.arrayBuffer()))
  try {
    const query = refer(yield* Query.fromBytes(body))
    if (!self.subscriptions.get(query.toString())) {
      // Check if we have this query stored in the database already.
      const selection = yield* DB.query(self.source, {
        select: {},
        where: [{ Case: [synopsys, 'synopsys/query', query] }],
      })

      // if we have not found match we store the query into a database.
      // we probably want to store actual query into a blob but this will do
      // for now.
      if (selection.length === 0) {
        yield* DB.transact(self.source, [
          { Assert: [synopsys, 'synopsys/query', query] },
          { Assert: [query, 'blob/content', body] },
        ])
      }
    }

    // Redirect to the subscription URL.
    return new Response(null, {
      status: 303,
      headers: {
        ...CORS,
        Location: new URL(`/${query}`, request.url).toString(),
      },
    })
  } catch (reason) {
    return error(
      { message: /** @type {Error} */ (reason).message },
      {
        status: 400,
        statusText: 'Invalid query',
      }
    )
  }
}

/**
 * @typedef {object} Self
 * @property {string} id - Current hash of the store.
 * @property {DB.API.Querier} source - The underlying data store.
 * @property {Map<string, ReturnType<broadcast>>} subscriptions - Active query sessions.
 * @property {Agent.Session} agent - The agent session.
 *
 * @typedef {Self & {source: DB.API.Transactor<Store.Commit>}} MutableSelf
 */

/**
 * @template {DB.Selector} [Select=DB.Selector]
 * @param {Self} self
 * @param {Agent.Reference<Agent.Query<Select>>} id
 */
export const subscribe = function* (self, id) {
  const channel = self.subscriptions.get(id.toString())
  if (channel) {
    return channel
  } else {
    const content = Agent.variable()
    const [selection] = yield* DB.query(self.source, {
      select: { content },
      where: [{ Case: [id, 'blob/content', content] }],
    })
    const bytes = selection?.content
    const query = bytes ? yield* Query.fromBytes(bytes) : null
    const subscription = query ? yield* self.agent.subscribe(query) : null
    const source = subscription ? toEventSource(subscription) : null
    const channel = source ? broadcast(source) : null
    if (channel) {
      self.subscriptions.set(id.toString(), channel)
      // Remove the subscription when the channel is closed.
      channel.closed.then(() => self.subscriptions.delete(id.toString()))
    }
    return channel
  }
}

/**
 * Subscribes to the session by opening a new event source connection and
 * adding it to the list of subscribers.
 *
 * @param {Self} self
 * @param {Request} request
 */
export const get = function* (self, request) {
  // If we land on the root URL we just return an empty response.
  const url = new URL(request.url)
  if (url.pathname === '/') {
    return ok({}, { status: 404 })
  }

  const id = url.pathname.slice(1)
  const query = Reference.fromString(id, null)
  if (query == null) {
    return error({ message: `Query ${id} was not found` }, { status: 404 })
  }
  const source = yield* subscribe(self, query)

  if (source) {
    return new Response(source.fork(), {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } else {
    return error({ message: `Query ${id} was not found` }, { status: 404 })
  }
}

/**
 * @typedef {object} HTTPOptions
 * @property {number} [status]
 * @property {string} [statusText]
 * @property {Record<string, string>} [headers]
 */
/**
 * @param {{}} ok
 * @param {HTTPOptions} [options]
 */
export const ok = (ok, options) => response({ ok }, options)

/**
 * @param {{}} error
 * @param {HTTPOptions} [options]
 */
export const error = (error, options) =>
  response({ error }, { status: 500, ...options })

/**
 * @param {Agent.Result} result
 * @param {HTTPOptions} [options]
 */
const response = (result, { status = 200, statusText, headers } = {}) =>
  new Response(JSON.stringify(result), {
    status,
    ...(statusText ? { statusText } : {}),
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      ...headers,
    },
  })
