import * as Type from '../type.js'
import * as Query from '../query.js'
import * as DB from 'datalogia'
import * as Selection from '../selection.js'
import * as Subscription from '../subscription.js'
import * as Task from '../../task.js'
import * as DAG from '../dag.js'
import * as JSON from '@ipld/dag-json'
import { refer } from '../../datum/reference.js'
import { broadcast } from '../sync.js'

/**
 * @typedef {(request: Request) => Promise<Response>} Fetch
 */

/**
 * @typedef {object} Open
 * @property {URL} url
 * @property {Fetch} [fetch]
 */

/**
 * @typedef {object} RemoteSession
 * @property {URL} url
 * @property {Fetch} fetch
 */

/**
 * Opens a new remote session.
 *
 * @param {Open} source
 */
export function* open({ url, fetch = globalThis.fetch }) {
  return new Remote({ url, fetch })
}

/**
 *
 * @param {Remote} session
 */
export function* close(session) {
  return {}
}

/**
 * @template {DB.Selector} [Select=DB.API.Selector]
 * @param {Remote} session
 * @param {DB.Query<Select>} query
 */
export function* subscribe(session, query) {
  const bytes = yield* Query.toBytes(query)
  const id = refer(bytes)
  const request = new Request(new URL(id.toString(), session.url).href, {
    method: 'PUT',
    headers: {
      'content-type': Query.contentType,
      accept: Subscription.contentType,
    },
    body: bytes,
  })
  const response = yield* Task.wait(session.fetch(request))

  const body = /** @type {ReadableStream<Uint8Array>} */ (response.body)
  const source =
    /** @type {ReadableStream<Type.Selection<Select>[]>} */
    (Selection.fromEventSource(body))

  return broadcast(source)
}

/**
 * @template {DB.Selector} [Select=DB.API.Selector]
 * @param {Remote} session
 * @param {DB.Query<Select>} query
 */
export function* query(session, query) {
  const bytes = yield* Query.toBytes(query)
  const id = refer(bytes)
  const request = new Request(new URL(id.toString(), session.url).href, {
    method: 'PUT',
    headers: {
      'content-type': Query.contentType,
      accept: Query.contentType,
    },
    body: bytes,
  })

  const response = yield* Task.wait(session.fetch(request))
  const body = yield* Task.wait(response.arrayBuffer())
  const selection = /** @type {Type.Selection<Select>[]} */ (
    yield* DAG.decode(JSON, new Uint8Array(body))
  )
  return selection
}

/**
 * @param {RemoteSession} session
 * @param {DB.Transaction} changes
 */
export function* transact(session, changes) {
  const request = new Request(session.url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: yield* DAG.encode(JSON, changes),
  })
  const response = yield* Task.wait(session.fetch(request))

  const buffer = yield* Task.wait(response.arrayBuffer())
  const data = yield* DAG.decode(JSON, new Uint8Array(buffer))
  const result = /** @type {Type.Result<Type.Commit, Error>} */ (data)

  if (result.error) {
    throw result.error
  } else {
    return result.ok
  }
}

/**
 * @implements {Type.Session}
 */
class Remote {
  /**
   * @param {object} source
   * @param {URL} source.url
   * @param {Fetch} source.fetch
   */
  constructor(source) {
    this.source = source
  }
  get url() {
    return this.source.url
  }
  /**
   * @param {Request} request
   */
  async fetch(request) {
    const accept = request.headers.get('accept') ?? ''
    /** @type {{accept?:string}} */
    const headers = accept === '' ? {} : { accept }
    const response = await this.source.fetch(request)
    // follow redirects
    switch (response.status) {
      /* c8 ignore next */
      case 302:
      case 303:
        return await this.source.fetch(
          new Request(
            /** @type {string} */ (response.headers.get('Location')),
            { headers }
          )
        )
      default: {
        return response
      }
    }
  }

  /**
   * @template {DB.Selector} [Select=DB.Selector]
   * @param {Type.Query<Select>} source
   */
  query(source) {
    return query(this, source)
  }
  /**
   * @template {DB.Selector} [Select=DB.Selector]
   * @param {Type.Query<Select>} query
   * @returns {Type.Task<Type.Subscription<Select>, Error>}
   */
  subscribe(query) {
    return subscribe(this, query)
  }
  /**
   *
   * @param {DB.Transaction} changes
   */
  transact(changes) {
    return transact(this, changes)
  }

  close() {
    return close(this)
  }
}
