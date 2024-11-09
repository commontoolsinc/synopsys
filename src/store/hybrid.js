import { refer } from 'merkle-reference'
import * as Type from './type.js'
import { Task } from 'datalogia'

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
    const durable = []
    for (const change of changes) {
      if (isEphemeral(change)) {
        ephemeral.push(change)
      } else {
        durable.push(change)
      }
    }

    if (durable.length) {
      const { after } = yield* this.source.durable.transact(durable)
      // Capture upstream state so we can capture it in the merkle root
      ephemeral.push({ Upsert: [refer({}), `~/durable`, after.id] })
    }

    const commit = yield* this.source.ephemeral.transact(changes)
    this.#revision = commit.after
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
}
