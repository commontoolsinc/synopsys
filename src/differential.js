import * as Type from './replica/type.js'
import * as Task from './task.js'
import * as Okra from '@canvas-js/okra'
import { toIterator } from './store/sequence.js'

/**
 * @typedef {Okra.SyncSource & {
 *   nodes(level: number, lowerBound?: Okra.Bound<Okra.Key>|null, upperBound?: Okra.Bound<Okra.Key>|null, options?: { reverse?: boolean }): Type.AwaitIterable<Okra.Node>
 * }} OkraSyncTarget
 *
 * @type {(source: Okra.SyncSource, target: OkraSyncTarget) => AsyncGenerator<Okra.Delta, void, void>}
 */
// We override type signature because it is incorrect
const sync = /** @type {any} */ (Okra.sync)

/**
 * @typedef {object} Delta
 * @property {Type.Change[]} local
 * @property {Type.Change[]} remote
 */

/**
 * Calculates the changes between local and remote databases.
 *
 * @param {Type.StoreReader} local
 * @param {Type.PullSource} remote
 * @param {(key: Uint8Array, source: Uint8Array, target: Uint8Array) => Task.Task<Uint8Array>} merge
 */
export function* differentiate(local, remote, merge) {
  /** @type {Delta} */
  const changes = { local: [], remote: [] }
  const target = new SyncTarget(local)
  const source = new PullSource(remote)
  const delta = sync(source, target)
  while (true) {
    const next = yield* Task.wait(delta.next())
    if (next.done) {
      break
    }
    const { key, source, target } = next.value
    if (source != null && target != null) {
      const value = yield* merge(key, source, target)
      changes.local.push([key, value])
      changes.remote.push([key, value])
    } else if (target != null) {
      changes.remote.push([key, target])
    } else if (source != null) {
      changes.local.push([key, source])
    }
  }

  return changes
}

class PullSource {
  /**
   * @param {Type.PullSource} source
   */
  constructor(source) {
    this.source = source
  }
  getRoot() {
    return Task.perform(this.source.getRoot())
  }
  /**
   * @param {number} level
   * @param {Uint8Array} key
   */
  getNode(level, key) {
    return Task.perform(this.source.getNode(level, key))
  }
  /**
   * @param {number} level
   * @param {Uint8Array} key
   */
  getChildren(level, key) {
    return Task.perform(this.source.getChildren(level, key))
  }
}

class SyncTarget extends PullSource {
  /**
   *
   * @param {Type.StoreReader} reader
   */
  constructor(reader) {
    super(reader)
    this.reader = reader
  }
  /** @type {Type.SyncTarget['nodes']} */
  nodes(level, lowerBound, upperBound, options) {
    return toIterator(this.reader.nodes(level, lowerBound, upperBound, options))
  }

  get entries() {
    throw new Error('Not implemented')
  }
  get has() {
    throw new Error('Not implemented')
  }
  get get() {
    throw new Error('Not implemented')
  }
  get keys() {
    throw new Error('Not implemented')
  }
}
