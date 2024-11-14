import { refer } from 'merkle-reference'
import * as Type from './type.js'
import { Task, transact, query } from 'datalogia'
import { differentiate } from '../differential.js'
import * as Remote from '../source/remote.js'
import * as Local from '../source/local.js'

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
 * @typedef {object} DataSource
 * @property {Type.Database} ephemeral
 * @property {Type.Database} durable
 */

/**
 * Opens a hybrid database instance.
 *
 * @param {DataSource} source
 */
export const from = (source) => new HybdridDatabase(source)

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
const updateDurableRoot = (root) => ({ Upsert: [refer({}), `~/durable`, root] })

/**
 * @typedef {Type.Variant<{
 *   Merge: Type.SynchronizationSource
 *   Transact: Type.Instruction[]
 * }>} Command
 */

/**
 * @implements {Type.Database}
 */
class HybdridDatabase {
  /** @type {Type.Revision|null} */
  #revision = null
  /**
   * @param {DataSource} source
   */
  constructor(source) {
    this.source = source
    this.writable = Task.wait({})
  }
  get store() {
    return this.source.durable.store
  }
  /**
   * @param {Type.FactsSelector} selector
   */
  *scan(selector) {
    const ephemeral = yield* Task.fork(this.source.ephemeral.scan(selector))
    const durable = yield* Task.fork(this.source.durable.scan(selector))

    return [...(yield* ephemeral), ...(yield* durable)]
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

    const commit = yield* this.source.ephemeral.transact(ephemeral)
    this.#revision = commit.after

    // If we have changes to durable store we need to schedule a write
    // after all prior writes are done. This ensures that the durable
    // store is not changing concurrently which could lead to problems.
    if (durable.length) {
      const invocation = Task.perform(HybdridDatabase.transact(this, durable))
      this.writable = Task.result(invocation)
      return yield* invocation
    } else {
      return commit
    }
  }

  /**
   * @param {HybdridDatabase} self
   * @param {Type.Transaction} changes
   */
  static *transact(self, changes) {
    yield* Task.result(self.writable)
    const { after } = yield* self.source.durable.transact(changes)
    // Capture upstream state so we can capture it in the merkle root

    const commit = yield* self.source.ephemeral.transact([
      updateDurableRoot(after.id),
    ])
    self.#revision = commit.after

    return commit
  }
  *status() {
    if (this.#revision == null) {
      const revision = yield* this.source.durable.status()
      if (this.#revision == null) {
        yield* this.transact([updateDurableRoot(revision.id)])
      }
    }

    return yield* this.source.ephemeral.status()
  }
  *close() {
    const ephemeral = yield* Task.fork(this.source.ephemeral.close())
    const durable = yield* Task.fork(this.source.durable.close())

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
    const invocation = Task.perform(HybdridDatabase.merge(this, source))
    this.writable = Task.result(invocation)
    return yield* invocation
  }

  /**
   *
   * @param {HybdridDatabase} self
   * @param {Type.SynchronizationSource} source
   */
  static *merge(self, source) {
    yield* self.writable
    return yield* self.source.durable.store.write(function* (writer) {
      const delta = yield* differentiate(
        writer,
        source,
        // Just picks the remote value as the winner
        function* (key, source, target) {
          return source
        }
      )

      const local = yield* writer.integrate(delta.local)
      const remote = yield* source.integrate(delta.remote)

      return { local, remote }
    })
  }
}
