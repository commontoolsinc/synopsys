import * as Type from '../type.js'
import * as DB from 'datalogia'
import * as Subscription from '../subscription.js'
import { refer } from '../../datum/reference.js'
import { promise } from '../sync.js'

/**
 * @typedef {object} Open
 * @property {Type.Store} source.store
 */

/**
 * @typedef {object} LocalSession
 * @property {Type.Store} store
 * @property {Set<Type.SignalController<Type.Commit>>} queue
 */

/**
 * Opens a new local session.
 *
 * @param {Open} options
 */
export const open = function* (options) {
  return new Local(options.store, new Set())
}

/**
 * Subscribes to the given query.
 *
 * @template {DB.Selector} [Select=DB.API.Selector]
 * @param {Local} session
 * @param {DB.Query<Select>} query
 */
export function* subscribe(session, query) {
  const source = new LocalSource(undefined, undefined, {
    query,
    session,
  })
  const subscription = yield* Subscription.open({ query, source })
  return subscription
}

/**
 * @template {DB.Selector} [Select=DB.API.Selector]
 * @extends {ReadableStream<Type.Selection<Select>[]>}
 */
class LocalSource extends ReadableStream {
  /**
   * @param {undefined} source
   * @param {undefined} strategy
   * @param {object} options
   * @param {DB.Query<Select>} options.query
   * @param {LocalSession} options.session
   */
  constructor(source, strategy, options) {
    super({
      pull: async (controller) => {
        // Loop until we receive an update that will result in an updated view.
        while (true) {
          // Wait for the view to become stale and then re-run a query.
          await this.stale
          if (this.cancelled) {
            return
          }
          const selection = await DB.query(this.session.store, this.query)
          if (this.cancelled) {
            return
          }

          // Setup a signal to be notified when the view becomes stale.
          this.stale = promise()
          this.session.queue.add(this.stale)

          const revision = refer(selection)
          if (this.revision.toString() !== revision.toString()) {
            this.revision = revision
            controller.enqueue(selection)
            break
          }
        }
      },
      cancel: () => {
        this.cancelled = true
        this.session.queue.delete(this.stale)
      },
    })
    this.cancelled = false
    this.revision = refer(/** @type {Type.Selection<Select>[]} */ ([]))
    this.query = options.query
    this.session = options.session
    this.stale = promise()
    this.stale.send({})
  }
}

/**
 * @param {Local} session
 * @param {DB.Transaction} changes
 * @returns {Type.Task<Type.Commit, Error>}
 */
export function* transact(session, changes) {
  const commit = yield* DB.transact(session.store, changes)
  // Broadcast commit to all the queued signals.
  yield* publish(session, commit)

  return commit
}

/**
 * Publishes commit to all the queued signals.
 *
 * @param {Local} session
 * @param {Type.Commit} commit
 */
export function* publish(session, commit) {
  const [...queue] = session.queue
  session.queue.clear()
  for (const signal of queue) {
    signal.send(commit)
  }
}

/**
 * @implements {LocalSession}
 */
class Local {
  /**
   *
   * @param {Type.Store} store
   * @param {Set<Type.SignalController<{}>>} queue
   */
  constructor(store, queue) {
    this.store = store
    this.queue = queue
  }

  /**
   * @template {DB.Selector} [Select=DB.Selector]
   * @param {DB.Query<Select>} query
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
