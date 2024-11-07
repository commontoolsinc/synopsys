import { IDBTree, IDBStore } from '@canvas-js/okra-idb'
import * as Okra from '@canvas-js/okra'
import * as IDB from 'idb'
import * as Store from './okra.js'
import { Task } from 'datalogia'
import { sync } from '@canvas-js/okra'
import { Async } from './store.js'

export * from './okra.js'

/**
 * Opens a database instance at the given URL. If the URL is not provided or
 * has a `memory:` protocol, an ephemeral in-memory database returned. If the
 * URL has a `file:` protocol, a persistent LMDB backed database is returned.
 *
 * @typedef {import('@canvas-js/okra-lmdb').TreeOptions & {
 *    name?: string
 *    version?: number
 *    store?: string
 * }} Open
 *
 * @param {Open} [source]
 */
export const open = function* ({
  name = 'synopsys',
  store = 'okra',
  version = 1,
  ...options
} = {}) {
  const idb = yield* Task.wait(
    IDB.openDB(name, version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      },
    })
  )
  const tree = yield* Task.wait(FixedIDBTree.open(idb, store, options))

  const source = new Async(tree)

  return yield* Store.open(source)
}

// @ts-expect-error
class FixedIDBTree extends IDBTree {
  /**
   *
   * @param {IDB.IDBPDatabase} db
   * @param {string} storeName
   * @param {Partial<Okra.Metadata>} options
   */
  static async open(db, storeName, options = {}) {
    const store = new IDBStore(db, storeName)
    // @ts-expect-error
    const tree = new this(store, options)
    await store.write(() => tree.initialize())
    return tree
  }
  /** @type {IDBTree['entries']} */
  async *entries(lowerBound, upperBound, options) {
    yield* await this.store.read(async () => {
      const entries = super.entries(lowerBound, upperBound, options)
      const members = []
      for await (const entry of entries) {
        members.push(entry)
      }
      return members.values()
    })
  }
}

/**
 * Merges two stores together.
 *
 * @param {IDBTree} remote
 * @param {Okra.ReadWriteTransaction} local
 * @param {(key: Uint8Array, source: Uint8Array, target: Uint8Array) => Uint8Array | Promise<Uint8Array>} merge
 */
export async function merge(remote, local, merge) {
  const changes = []
  for await (const delta of sync(remote, local)) {
    if (delta.source != null && delta.target != null) {
      const value = await merge(delta.key, delta.source, delta.target)
      await local.set(delta.key, value)
      changes.push([delta.key, value])
    } else if (delta.target != null) {
      changes.push([delta.key, delta.target])
    } else if (delta.source != null) {
      await local.set(delta.key, delta.source)
    }
  }

  for (const [key, value] of changes) {
    await remote.set(key, value)
  }
}
