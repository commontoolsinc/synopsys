import * as Query from './agent/query.js'
import * as DB from 'datalogia'
import { Link } from 'datalogia'
import * as Task from 'datalogia/task'
import * as JSON from '@ipld/dag-json'

/**
 * @template {DB.API.Selector} [Select=DB.API.Selector]
 * @typedef {object} Session
 * @property {DB.Query<Select>} query
 * @property {DB.Querier} source
 * @property {Set<WritableStreamDefaultWriter<Uint8Array>>} subscriber
 * @property {SessionState} state
 */

/**
 * @template [Model=DB.API.InferBindings<DB.API.Selector>[]]
 * @typedef {object} SessionState
 * @property {string} id
 * @property {Model} product
 */

/**
 * Open a session for the given query.
 *
 * @param {object} options
 * @param {object} options.query
 * @param {DB.Querier} options.source
 */
export const open = function* (options) {
  const query = yield* Query.fromJSON(options.query)
  const product = yield* DB.query(options.source, query)
  const session = {
    query,
    source: options.source,
    subscriber: new Set(),
    state: { product, id: DB.Link.of(product).toString() },
  }

  return session
}

/**
 * Notifies all the connected subscribers about the new state of the
 * subscribed query.
 *
 * @param {Session} session
 */
export const notify = (session) =>
  Task.spawn(function* () {
    // If we do not have any active subscriptions we avoid the work.
    if (session.subscriber.size > 0) {
      // We compute new session state.
      const state = yield* compute(session)

      // If computed state id is the same as the current state id no changes
      // have occurred so we skip the notification.
      if (session.state.id !== state.id) {
        session.state = state
        const writes = []
        const payload = toEventSourceMessage(state)

        for (const writer of session.subscriber) {
          writes.push(writer.write(payload))
        }

        yield* Task.wait(Promise.all(writes))
      }
    }
  })

/**
 * Creates subscription for the given session and returns a readable stream
 * where the state changes will be pushed.
 *
 * @param {Session} session
 */
export const subscribe = function* (session) {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  // Start a task that will unsubscribe when the writer is closed.
  yield* Task.fork(unsubscribe(session, writer))

  // If this is a first subscription we recompute the session state as state has
  // not being maintained while we did not had any subscribers.
  if (session.subscriber.size === 0) {
    session.state = yield* compute(session)
  }

  session.subscriber.add(writer)
  writer.write(toEventSourceMessage(session.state))

  return readable
}

/**
 * @param {Session} session
 * @param {WritableStreamDefaultWriter<Uint8Array>} writer
 */
const unsubscribe = function* (session, writer) {
  yield* Task.perform(Task.wait(writer.closed)).result()
  session.subscriber.delete(writer)
}

/**
 * @param {Session} session
 * @returns {Task.Task<SessionState, Error>}
 */
function* compute(session) {
  const product = yield* DB.query(session.source, session.query)
  // We derive the cryptographic id from the computed product.
  const id = Link.of(product).toString()

  return { product, id }
}

/**
 * Encodes result of the query as event source message.
 *
 * @param {SessionState} state
 */
export const toEventSourceMessage = (state) => {
  const prefix = encoder.encode(`id:${state.id}\nevent:change\ndata:`)
  const body = JSON.encode(state.product)

  const payload = new Uint8Array(prefix.length + body.length + SUFFIX.length)
  let offset = 0

  payload.set(prefix, offset)
  offset += prefix.length

  payload.set(body, offset)
  offset += body.length

  payload.set(SUFFIX, offset)
  offset += SUFFIX.length

  return payload
}
const SUFFIX = new TextEncoder().encode('\n\n')

const encoder = new TextEncoder()
