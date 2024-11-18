import { refer } from '../datum/reference.js'
import * as Type from '../store/type.js'
import { transact, query } from 'datalogia'
import { differentiate } from '../differential.js'
import * as Task from '../task.js'
import * as Remote from '../connection/remote.js'
import * as Local from '../connection/local.js'
import * as Source from './store.js'
import { channel } from '../replica/sync.js'
import { subscribe } from '../replica/session/local.js'
import * as Query from '../replica/query.js'
export { transact, query }

/**
 * @typedef {Type.Variant<{
 *   remote: Remote.Connection
 *   local: Local.Connection
 * }>} Address
 */

/**
 * @param {Address} source
 */
export const connect = (source) =>
  source.local ? Local.open(source.local) : Remote.open(source.remote)

/**
 * @typedef {object} Source
 * @property {Type.Store} ephemeral
 * @property {Type.Store} durable
 */

/**
 * Opens a hybrid database instance.
 *
 * @param {Source} source
 */
export function* open(source) {
  const ephemeral = yield* Source.open(source.ephemeral)
  const durable = yield* Source.open(source.durable)

  return new HybridSource({ ephemeral, durable, store: source.durable })
}

/**
 * @param {Type.Instruction} instruction
 */
const isEphemeral = ({ Assert, Retract, Upsert }) => {
  const fact = Assert ?? Retract ?? Upsert
  const attribute = String(fact?.[1] ?? '')
  return attribute[0] === '~' && attribute[1] === '/'
}

/**
 * @param {string} root
 * @returns {Type.Instruction}
 */
const updateDurable = (root) => ({ Upsert: [refer({}), `~/durable`, root] })

/**
 * @typedef {Type.Variant<{
 *   Merge: Type.SynchronizationSource
 *   Transact: Type.Instruction[]
 * }>} Command
 */

/**
 * @implements {Type.DataBase}
 */
class HybridSource {
  /**
   * @param {object} source
   * @param {Type.DataSource} source.ephemeral
   * @param {Type.DataSource} source.durable
   * @param {Type.Store} source.store
   * @param {Map<string, Type.Subscription>} [source.subscriptions]
   */
  constructor({ ephemeral, durable, store, subscriptions = new Map() }) {
    this.ephemeral = ephemeral
    this.durable = durable
    this.store = store

    this.transaction = channel()
    this.subscriptions = subscriptions

    this.writable = Task.wait({})
  }

  get source() {
    return this
  }

  /**
   * @param {Type.FactsSelector} selector
   */
  *scan(selector) {
    const ephemeral = yield* Task.fork(this.ephemeral.scan(selector))
    const durable = yield* Task.fork(this.durable.scan(selector))

    return [...(yield* ephemeral), ...(yield* durable)]
  }

  /**
   * @template {Type.Selector} [Select=Type.Selector]
   * @param {Type.Query<Select>} source
   */
  query(source) {
    return query(this, source)
  }
  /**
   * @param {Type.Transaction} changes
   */
  *transact(changes) {
    const ephemeral = []
    /** @type {Type.Instruction[]} */
    const durable = []
    for (const change of changes) {
      if (isEphemeral(change)) {
        ephemeral.push(change)
      } else {
        durable.push(change)
      }
    }

    const commit = yield* this.ephemeral.transact(ephemeral)

    // If we have changes to durable store we need to schedule a write
    // after all prior writes are done. This ensures that the durable
    // store is not changing concurrently which could lead to problems.
    if (durable.length) {
      const invocation = Task.perform(HybridSource.transact(this, durable))
      this.writable = Task.result(invocation)
      const commit = yield* invocation
      this.transaction.write(commit)
      return commit
    } else {
      this.transaction.write(commit)
      return commit
    }
  }

  /**
   * @param {HybridSource} self
   * @param {Type.Transaction} changes
   */
  static *transact(self, changes) {
    yield* Task.result(self.writable)
    const { after } = yield* self.durable.transact(changes)
    // Capture upstream state so we can capture it in the merkle root

    return yield* self.ephemeral.transact([updateDurable(after.id)])
  }

  *close() {
    const ephemeral = yield* Task.fork(this.ephemeral.close())
    const durable = yield* Task.fork(this.durable.close())

    yield* ephemeral
    yield* durable

    return {}
  }

  /**
   * Pulls changes from remote database.
   *
   * @param {Type.SynchronizationSource} source
   */
  *merge(source) {
    const invocation = Task.perform(HybridSource.merge(this, source))
    this.writable = Task.result(invocation)
    return yield* invocation
  }

  /**
   *
   * @param {HybridSource} self
   * @param {Type.SynchronizationSource} source
   */
  static *merge(self, source) {
    yield* self.writable
    return yield* self.store.write(function* (writer) {
      const delta = yield* differentiate(
        writer,
        source,
        // Just picks the remote value as the winner
        function* (key, source, target) {
          return source
        }
      )

      let result = {}
      if (delta.local.length > 0) {
        result.local = yield* writer.integrate(delta.local)
        self.transaction.write(result.local)
      }

      if (delta.remote.length > 0) {
        result.remote = yield* writer.integrate(delta.remote)
      }

      return result
    })
  }

  /**
   * @template {Type.Selector} Select
   * @param {Type.Query<Select>} query
   */
  *subscribe(query) {
    const bytes = yield* Query.toBytes(query)
    const key = refer(bytes).toString()
    const subscription = this.subscriptions.get(key)
    if (!subscription) {
      const subscription = yield* subscribe(this, query)
      this.subscriptions.set(key, subscription)
      // Remove the subscription when it closes.
      subscription.closed.then(() => this.subscriptions.delete(key))
      return subscription
    }

    return /** @type {Type.Subscription<Select>} */ (subscription)
  }
}
