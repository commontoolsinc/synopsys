import * as Type from '../type.js'
import * as Query from '../query.js'
import * as DB from 'datalogia'
import * as Selection from '../selection.js'
import { Task } from 'datalogia'
import * as DAG from '../dag.js'
import * as JSON from '@ipld/dag-json'
import { of as refer } from '../../datum/reference.js'
import { broadcast } from '../sync.js'

/**
 * @typedef {object} Open
 * @property {URL} url
 */

/**
 * @typedef {object} RemoteSession
 * @property {URL} source
 */

/**
 * Opens a new remote session.
 *
 * @param {Open} options
 */
export function* open(options) {
  return new Remote(options.url)
}

/**
 * @template {DB.Selector} [Select=DB.API.Selector]
 * @param {Remote} session
 * @param {DB.Query<Select>} query
 */
export function* subscribe(session, query) {
  const bytes = yield* Query.toBytes(query)
  const id = refer(bytes)
  const response = yield* Task.wait(
    fetch(new URL(id.toString(), session.source).href, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: bytes,
    })
  )

  const body = /** @type {ReadableStream<Uint8Array>} */ (response.body)
  const source =
    /** @type {ReadableStream<Type.Selection<Select>[]>} */
    (Selection.fromEventSource(body))

  return broadcast(source)
}

/**
 * @param {RemoteSession} session
 * @param {DB.Transaction} changes
 */
export function* transact(session, changes) {
  const response = yield* Task.wait(
    fetch(session.source.href, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: yield* DAG.encode(JSON, changes),
    })
  )

  const buffer = yield* Task.wait(response.arrayBuffer())
  const data = yield* DAG.decode(JSON, new Uint8Array(buffer))
  const result = /** @type {Type.Result<Type.Commit, Error>} */ (data)

  if (result.error) {
    throw result.error
  } else {
    return result.ok
  }
}

class Remote {
  /**
   * @param {URL} source
   */
  constructor(source) {
    this.source = source
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
  toJSON() {
    return this
  }
}
