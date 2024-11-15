import * as DB from 'datalogia'
import { Task } from 'datalogia'
import * as JSON from '@ipld/dag-json'
export * as DB from 'datalogia'
import * as Replica from './replica.js'
import * as Reference from './datum/reference.js'
import * as Query from './replica/query.js'
import * as Subscription from './replica/subscription.js'
import * as Selection from './replica/selection.js'
import { refer, synopsys } from './replica.js'
import { toEventSource } from './replica/selection.js'
import { broadcast } from './replica/sync.js'
import * as DAG from './replica/dag.js'
import * as Sync from './sync.js'
import * as Source from './source/store.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Accept',
}

/**
 * Creates a new URL with the correct protocol based on the request.
 *
 * @param {Request} request
 * @param {string} path
 */
const rewrite = (request, path) => {
  const newUrl = new URL(path, request.url)
  if (request.headers.get('x-forwarded-proto') === 'https') {
    newUrl.protocol = 'https:'
  }
  return newUrl
}

/**
 * Connects to the  service by opening the underlying store.
 *
 * @param {object} source
 * @param {Sync.Service} [source.sync]
 * @param {Replica.Store} source.store
 * @param {Replica.BlobStore} source.blobs
 * @returns {Task.Task<Service, Error>}
 */
export const open = function* ({ store, blobs, sync }) {
  const source = yield* Source.open(store)
  const replica = yield* Replica.open({ local: { source } })

  return new Service(replica, sync, source, blobs)
}

export class Service {
  /**
   * @param {Replica.Replica} replica
   * @param {Sync.Service|undefined} sync
   * @param {Replica.DataSource} source
   * @param {Replica.BlobStore} blobs
   * @param {Map<string, ReturnType<broadcast>>} subscriptions
   *
   */
  constructor(replica, sync, source, blobs, subscriptions = new Map()) {
    this.replica = replica
    this.sync = sync
    this.source = source
    this.blobs = blobs
    this.subscriptions = subscriptions

    this.fetch = this.fetch.bind(this)
  }

  /**
   * @param {Request} request
   */
  fetch(request) {
    return Task.perform(fetch(this, request))
  }
}

/**
 * Closes down the service by closing the underlying store.
 *
 * @param {MutableSelf} self
 */
export const close = function* (self) {
  yield* self.source.close()
}

/**
 *
 * @param {MutableSelf} self
 * @param {Request} request
 * @returns {Task.Task<Response, Error>}
 */
export const fetch = function* (self, request) {
  switch (request.method) {
    case 'OPTIONS':
      return new Response(null, {
        status: 204,
        statusText: 'YOLO',
        headers: CORS,
      })
    case 'HEAD':
      return yield* head(self, request)
    case 'PUT':
      return yield* put(self, request)
    case 'PATCH':
      return yield* patch(self, request)
    case 'GET':
      return yield* get(self, request)
    case 'POST':
      return yield* post(self, request)
    default:
      return yield* error(
        { message: 'Method not allowed' },
        { status: 405, statusText: 'Method Not Allowed' }
      )
  }
}

/**
 * @param {MutableSelf} self
 * @param {Replica.Transaction} changes
 */
export function* transact(self, changes) {
  return yield* self.replica.transact(changes)
}

/**
 * @param {MutableSelf} self
 * @param {Request} request
 */
export function* patch(self, request) {
  try {
    const body = new Uint8Array(yield* Task.wait(request.arrayBuffer()))
    const changes = /** @type {DB.Transaction} */ (
      yield* DAG.decode(JSON, body)
    )
    const commit = yield* transact(self, changes)
    return yield* ok({
      before: commit.before,
      after: commit.after,
    })
  } catch (reason) {
    const { name, message, stack } = /** @type {Partial<Error>} */ (
      reason /* c8 ignore next */ ?? {}
    )

    return yield* error(
      {
        error: {
          name,
          message,
          stack,
        },
      },
      {
        // It could be that server has an error, but most likely it is
        // bad request.
        status: 400,
      }
    )
  }
}

/**
 * @param {MutableSelf} self
 * @param {Request} request
 * @returns {Task.Task<Response, Error>}
 */
export function* put(self, request) {
  const contentType = request.headers.get('content-type')

  switch (contentType) {
    case Query.contentType:
      return yield* importQuery(self, request)
    case 'application/json':
      return yield* importJSON(self, request)
    default:
      return yield* importBlob(self, request)
  }
}

/**
 * @param {MutableSelf} self
 * @param {Request} request
 */
export function* post(self, request) {
  const accept = request.headers.get('accept')
  if (self.sync == null) {
    return yield* error(
      { message: 'Sync protocol is not available' },
      { status: 400, statusText: 'Bad Request' }
    )
  }

  switch (accept) {
    case Sync.contentType:
      return new Response(
        request.body?.pipeThrough(Sync.synchronize(self.sync)),
        {
          status: 200,
          headers: {
            ...CORS,
            contentType: Sync.contentType,
          },
        }
      )
    default:
      return yield* error(
        { message: 'Unsupported content type' },
        { status: 400, statusText: 'Bad Request' }
      )
  }
}

/**
 * @param {MutableSelf} self
 * @param {Request} request
 * @returns {Task.Task<Response, Error>}
 */
export function* importQuery(self, request) {
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
        Location: rewrite(request, `/${query}`).toString(),
      },
    })
  } catch (reason) {
    return yield* error(
      { message: /** @type {Error} */ (reason).message },
      {
        status: 400,
        statusText: 'Invalid query',
      }
    )
  }
}

/**
 * @param {MutableSelf} self
 * @param {Request} request
 * @returns {Task.Task<Response, Error>}
 */
export function* importJSON(self, request) {
  const body = new Uint8Array(yield* Task.wait(request.arrayBuffer()))
  try {
    const json = yield* DAG.decode(JSON, body)
    const commit = yield* transact(
      self,
      /** @type {Replica.Transaction} */ ([{ Import: json }])
    )
    return yield* ok({
      before: commit.before,
      after: commit.after,
    })
  } catch (reason) {
    return yield* error(
      { message: /** @type {Error} */ (reason).message },
      {
        status: 400,
        statusText: 'Invalid JSON payload',
      }
    )
  }
}

/**
 * @param {MutableSelf} self
 * @param {Request} request
 * @returns {Task.Task<Response, Error>}
 */
export function* importBlob(self, request) {
  const blob = yield* Task.wait(request.blob())
  try {
    const buffer = yield* Task.wait(blob.arrayBuffer())
    const id = refer(new Uint8Array(buffer))

    yield* self.blobs.put(id.toString(), blob)
    const contentType =
      request.headers.get('content-type') ?? 'application/octet-stream'

    const commit = yield* transact(self, [
      { Assert: [id, `content/type`, contentType] },
      { Assert: [id, `content/length`, blob.size] },
    ])

    return yield* ok(
      {
        before: commit.before,
        after: commit.after,
      },
      {
        status: 303,
        headers: {
          ...CORS,
          location: rewrite(request, `/${id}`).toString(),
        },
      }
    )
  } catch (reason) {
    return yield* error(
      { message: /** @type {Error} */ (reason).message },
      {
        status: 400,
        statusText: 'Invalid JSON payload',
      }
    )
  }
}

/**
 * @typedef {object} Self
 * @property {DB.API.Querier} source - The underlying data store.
 * @property {Replica.BlobReader} blobs
 * @property {Map<string, ReturnType<broadcast>>} subscriptions - Active query sessions.
 * @property {Replica.Replica} replica
 *
 * @typedef {Self & {sync?: Sync.Service, source: Replica.DataSource, blobs: Replica.BlobStore}} MutableSelf
 */

/**
 * @template {DB.Selector} [Select=DB.Selector]
 * @param {Self} self
 * @param {Replica.Reference<Replica.Query<Select>>} id
 */
export const subscribe = function* (self, id) {
  const channel = self.subscriptions.get(id.toString())
  if (channel) {
    return channel
  } else {
    const { content } = Replica.$
    const [selection] = yield* DB.query(self.source, {
      select: { content },
      where: [{ Case: [id, 'blob/content', content] }],
    })
    const bytes = selection?.content
    const query = bytes ? yield* Query.fromBytes(bytes) : null
    const subscription = query ? yield* self.replica.subscribe(query) : null
    const source = subscription ? toEventSource(subscription.fork()) : null
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
 * @template {DB.Selector} [Select=DB.Selector]
 * @param {Self} self
 * @param {Replica.Reference<Replica.Query<Select>>} id
 */
export function* query(self, id) {
  const { content } = Replica.$
  const [match] = yield* DB.query(self.source, {
    select: { content },
    where: [{ Case: [id, 'blob/content', content] }],
  })
  const bytes = match?.content
  const query = bytes ? yield* Query.fromBytes(bytes) : null
  const selection = query ? yield* DB.query(self.source, query) : null
  if (selection) {
    return selection
  } else {
    throw new RangeError(`Query ${id} was not found`)
  }
}

/**
 * @param {Self} self
 * @param {Request} request
 */
export const head = function* (self, request) {
  const url = new URL(request.url)
  try {
    const entity = Reference.fromString(url.pathname.slice(1))
    const { type, size } = Replica.$
    const [match] = yield* DB.query(self.source, {
      select: { type, size },
      where: [
        { Case: [entity, 'content/type', type] },
        { Case: [entity, 'content/length', size] },
      ],
    })

    if (match) {
      return new Response(null, {
        status: 200,
        headers: {
          ...CORS,
          'content-type': match.type,
          'content-length': match.size,
        },
      })
    } else {
      return yield* error(
        { message: `Content ${entity} not found` },
        { status: 404 }
      )
    }
  } catch (reason) {
    return yield* error({ message: Object(reason).message }, { status: 404 })
  }
}

/**
 * @param {Self} self
 * @param {Request} request
 */
export const get = function* (self, request) {
  // If we land on the root URL we just return an empty response.
  const url = new URL(request.url)
  if (url.pathname === '/') {
    return yield* ok({}, { status: 404 })
  }
  const accept = request.headers.get('accept')

  switch (accept) {
    case Selection.contentType:
    case 'application/json':
      return yield* getSelection(self, request)
    case Subscription.contentType:
      return yield* getSubscription(self, request)
    default:
      return yield* getBlob(self, request)
  }
}

/**
 * Subscribes to the session by opening a new event source connection and
 * adding it to the list of subscribers.
 *
 * @param {Self} self
 * @param {Request} request
 */
export function* getSubscription(self, request) {
  // If we land on the root URL we just return an empty response.
  const url = new URL(request.url)
  if (url.pathname === '/') {
    return yield* ok({}, { status: 404 })
  }

  try {
    const id = url.pathname.slice(1)
    const query = Reference.fromString(id, null)
    if (query == null) {
      return yield* error(
        { message: `Query ${id} was not found` },
        { status: 404 }
      )
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
      return yield* error(
        { message: `Query ${id} was not found` },
        { status: 404 }
      )
    }
  } catch (reason) {
    return yield* error({ message: Object(reason).message }, { status: 400 })
  }
}

/**
 * @param {Self} self
 * @param {Request} request
 */
export function* getSelection(self, request) {
  // If we land on the root URL we just return an empty response.
  const url = new URL(request.url)
  const id = url.pathname.slice(1)
  const source = Reference.fromString(id, null)
  if (source == null) {
    return yield* error(
      { message: `Query ${id} was not found` },
      { status: 404 }
    )
  }
  try {
    const selection = yield* query(self, source)
    return new Response(yield* DAG.encode(JSON, selection), {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': Selection.contentType,
      },
    })
  } catch (reason) {
    return yield* error({ message: Object(reason).message }, { status: 404 })
  }
}

/**
 * @param {Self} self
 * @param {Request} request
 */
export function* getBlob(self, request) {
  const url = new URL(request.url)
  const id = url.pathname.slice(1)
  try {
    const range = request.headers.get('range')
    const blob = yield* self.blobs.get(id)
    if (range) {
      const [start, end] = range.slice(6).split('-').map(Number)
      const slice = blob.slice(start, end === 0 ? blob.size : end)
      return new Response(slice, {
        status: 206,
        headers: {
          ...CORS,
          'Content-Type': blob.type,
          'Content-Length': `${slice.size}`,
          'Content-Range': `bytes ${start}-${start + slice.size}/${blob.size}`,
        },
      })
    } else {
      return new Response(blob, {
        status: 200,
        headers: {
          ...CORS,
          'Content-Length': `${blob.size}`,
          'Content-Type': blob.type,
        },
      })
    }
  } catch (reason) {
    return yield* error({ message: Object(reason).message }, { status: 404 })
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
export const ok = (ok, options) => respond({ ok }, options)

/**
 * @param {{}} error
 * @param {HTTPOptions} [options]
 */
export const error = (error, options) =>
  respond({ error }, { status: 500, ...options })

/**
 * @param {Replica.Result} result
 * @param {HTTPOptions} [options]
 */
const respond = function* (result, { status = 200, statusText, headers } = {}) {
  try {
    return new Response(yield* DAG.encode(JSON, result), {
      status,
      ...(statusText ? { statusText } : {}),
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        ...headers,
      },
    })
    ///* c8 ignore next 18 */ not sure how to test this
  } catch (error) {
    return new Response(
      yield* DAG.encode(JSON, {
        error: {
          message: /** @type {null|{message?:unknown}} */ (error)?.message,
          stack: /** @type {null|{stack?:unknown}} */ (error)?.stack,
        },
      }),
      {
        status: 500,
        headers: {
          ...CORS,
          'Content-Type': 'application/json',
          ...headers,
        },
      }
    )
  }
}
