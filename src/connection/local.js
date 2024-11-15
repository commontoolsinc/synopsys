import * as Type from '../replica/type.js'

/**
 * @typedef {object} Connection
 * @property {Type.Store} store
 *
 * @param {Connection} source
 */
export function* open({ store }) {
  return new LocalSession(store)
}

/**
 * @implements {Type.SynchronizationSource}
 */
class LocalSession {
  /**
   * @param {Type.Store} store
   */
  constructor(store) {
    this.store = store
  }
  getRoot() {
    return this.store.read((reader) => reader.getRoot())
  }
  /**
   * @type {Type.SynchronizationSource['getNode']}
   */
  getNode(level, key) {
    return this.store.read((reader) => reader.getNode(level, key))
  }
  /**
   * @type {Type.SynchronizationSource['getChildren']}
   */
  getChildren(level, key) {
    return this.store.read((reader) => reader.getChildren(level, key))
  }

  /**
   * @type {Type.SynchronizationSource['integrate']}
   */
  integrate(changes) {
    return this.store.write((writer) => writer.integrate(changes))
  }
}
