import * as Type from '../type.js'
import * as DB from 'datalogia'
import { Task } from 'datalogia'
import { refer } from '../../datum/reference.js'
import { broadcast, channel } from '../sync.js'

/**
 * @typedef {object} Open
 * @property {Type.DataStore} source.store
 */

/**
 * Local session state. It holds a reference to the underlying store and a queue
 * of signals awaiting to be notified of a commit. Active subscriptions will
 * queue up to be notified of commits, but when they become inactive they will
 * stop listening for commits.
 *
 * @typedef {object} LocalSession
 * @property {Type.DataStore} store
 * @property {Type.Reader<Type.Commit, never>} transaction
 */

/**
 * Opens a new local session.
 *
 * @param {Open} options
 */
export const open = function* (options) {
  return new Local(options.store)
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

  return broadcast(source)
}

/**
 * This is a readable stream that produces recomputed query selections when
 * underlying session is transacted. It queues up commit signals while it is
 * being consumed and stops queuing it is not. This gives us a pull based
 * model of query re-evaluation, meaning it does not evaluate query on every
 * commit, only does it while being consumed.
 *
 *
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
      pull: async (subscriber) => {
        // Poll view until stream is cancelled or we get a new selection. If we
        // get a selection forward it downstream and break the loop until the
        // next pull from the subscriber.
        while (!this.cancelled) {
          const poll = Task.perform(this.poll())
          const selection = await poll
          // If we got a selection we enqueue it to the subscriber and break the
          // loop.
          if (selection) {
            subscriber.enqueue(selection)
            break
          }
        }
      },
      // If stream is cancelled we mark it as such. On the next commit our
      // polling loop will break and this stream could be garbage collected.
      cancel: () => {
        this.cancelled = true
      },
    })

    // Start off without any revision, that way first result will be pushed
    // regardless of its value.
    this.revision = null
    // Stream is not cancelled initially.
    this.cancelled = false
    // Reference to the underlying query, which is used to re-evaluate on
    // commit.
    this.query = options.query
    this.session = options.session
  }

  *poll() {
    // If we have revision we wait for the new session commit before we
    // re-evaluate the query. If we don not have revision yet we want to
    // evaluate the query immediately.
    if (this.revision) {
      yield* this.session.transaction.read()

      // If stream was cancelled while we were waiting we abort as subscriber
      // is no longer interested in the results.
      ///* c8 ignore next 3 */ not sure how to test this
      if (this.cancelled) {
        return null
      }
    }

    const selection = yield* DB.query(this.session.store, this.query)
    // If stream was cancelled while we were evaluating a query we abort as
    // subscriber is no longer interested in the results.
    ///* c8 ignore next 3 */ not sure how to test this
    if (this.cancelled) {
      return null
    }

    // If new query result is different from the previous one we update a
    // revision and return new result. Otherwise we return `null` as there
    // is nothing new for the subscriber.
    const revision = refer(selection)
    if (this.revision?.toString() !== revision.toString()) {
      // update local revision
      this.revision = revision
      // We break the loop as we don't react to commits unless subscriber
      // pulls from the stream.
      return selection
    }

    return null
  }
}

/**
 * @param {Local} session
 * @param {DB.Transaction} changes
 * @returns {Type.Task<Type.Commit, Error>}
 */
export function* transact(session, changes) {
  const commit = yield* DB.transact(session.store, changes)

  // Write a new commit into transaction channel.
  session.transaction.write(commit)

  return commit
}

/**
 * @implements {LocalSession}
 */
class Local {
  /**
   *
   * @param {Type.DataStore} store
   */
  constructor(store) {
    this.store = store
    this.transaction = channel()
  }

  /**
   * @template {DB.Selector} [Select=DB.Selector]
   * @param {DB.Query<Select>} query
   */
  subscribe(query) {
    return subscribe(this, query)
  }

  /**
   * @param {DB.Transaction} changes
   */
  transact(changes) {
    return transact(this, changes)
  }
}
