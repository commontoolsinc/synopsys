import * as Type from './replica/type.js'
import { Task } from 'datalogia'
import { sync } from '@canvas-js/okra'

/**
 * @typedef {object} Delta
 * @property {Type.Change[]} local
 * @property {Type.Change[]} remote
 */

/**
 * Calculates the changes between local and remote databases.
 *
 * @param {Type.TreeReader} local
 * @param {Type.PullSource} remote
 * @param {(key: Uint8Array, source: Uint8Array, target: Uint8Array) => Task.Task<Uint8Array>} merge
 */
export function* differentiate(local, remote, merge) {
  /** @type {Delta} */
  const changes = { local: [], remote: [] }
  /** @type {Type.ReadOnlyTransaction} */
  const target = /** @type {any} */ (new SyncTarget(local))
  const source = new SyncSource(remote)
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

class SyncSource {
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

class SyncTarget extends SyncSource {
  /**
   *
   * @param {Type.TreeReader} reader
   */
  constructor(reader) {
    super(reader)
    this.reader = reader
  }
  /** @type {Type.TreeReader['nodes']} */
  nodes(level, lowerBound, upperBound, options) {
    return this.reader.nodes(level, lowerBound, upperBound, options)
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
