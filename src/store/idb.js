import { IDBTree, IDBStore } from '@canvas-js/okra-idb'
import * as IDB from 'idb'
import { Task } from 'datalogia'
import { Async } from './store.js'
import * as Type from './type.js'

export * from '../source/store.js'

/**
 * Opens a database instance at the given URL. If the URL is not provided or
 * has a `memory:` protocol, an ephemeral in-memory database returned. If the
 * URL has a `file:` protocol, a persistent LMDB backed database is returned.
 *
 * @typedef {object} OpenDB
 * @typedef {import('@canvas-js/okra').Metadata} Metadata
 *
 * @typedef {object} Address
 * @property {string} name
 * @property {number} version
 * @property {string} store
 * @property {Partial<Metadata>} [tree]
 *
 *
 * @typedef {Type.Variant<{
 *   url: URL,
 *   idb: Address
 * }>} Open
 *
 * @param {Open} [source]
 */
export const open = function* (source) {
  const {
    name = 'synopsys',
    store = 'okra',
    version = 1,
    tree = {},
  } = source?.idb ? source.idb : source?.url ? fromURL(source.url) : {}

  const idb = yield* Task.wait(
    IDB.openDB(name, version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      },
    })
  )
  const okra = yield* Task.wait(FixedIDBTree.open(idb, store, tree))

  return new Async(okra)
}

/**
 * @param {URL} url
 * @returns {Address}
 */
const fromURL = (url) => {
  const { pathname, searchParams } = url
  const [database, store] = pathname.split(':')
  const [name, revision] = database.split('@')
  const version = Number(revision) | 0
  const Q = Number(searchParams.get('Q'))
  const K = Number(searchParams.get('K'))

  const treeOptions = Q > 0 && K > 0 ? { tree: { Q, K } } : {}

  return {
    name,
    store,
    version: version,
    ...treeOptions,
  }
}

const Tree = IDBTree.prototype.constructor
// @ts-expect-error
class FixedIDBTree extends IDBTree {
  /**
   *
   * @param {IDB.IDBPDatabase} db
   * @param {string} storeName
   * @param {Partial<Metadata>} options
   */
  static async open(db, storeName, options = {}) {
    const store = new IDBStore(db, storeName)
    // @ts-expect-error
    const tree = new this(store, options)
    await store.write(() => tree.initialize())
    return /** @type {FixedIDBTree} */ (tree)
  }
  /** @type {IDBTree['entries']} */
  async *entries(lowerBound, upperBound, options) {
    if (this.store.txn === null) {
      this.store.txn = this.store.db.transaction(
        this.store.storeName,
        'readonly'
      )
      try {
        yield* super.entries(lowerBound, upperBound, options)
      } finally {
        this.store.txn = null
      }
    } else {
      yield* super.entries(lowerBound, upperBound, options)
    }
  }

  /** @type {IDBTree['nodes']} */
  async *nodes(level, lowerBound, upperBound, options) {
    if (this.store.txn === null) {
      this.store.txn = this.store.db.transaction(
        this.store.storeName,
        'readonly'
      )
      try {
        yield* super.nodes(level, lowerBound, upperBound, options)
      } finally {
        this.store.txn = null
      }
    } else {
      yield* super.nodes(level, lowerBound, upperBound, options)
    }
  }
}
