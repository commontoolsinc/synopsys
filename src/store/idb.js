import { IDBTree } from '@canvas-js/okra-idb'
import { openDB } from 'idb'
import { Task } from 'datalogia'
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
    openDB(name, version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      },
    })
  )
  const okra = yield* Task.wait(IDBTree.open(idb, store, tree))

  return new IDB(okra)
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

class IDB {
  /**
   * @param {IDBTree} tree
   */
  constructor(tree) {
    this.tree = tree
  }
  /**
   * @type {Type.Store['read']}
   */
  *read(read) {
    let task

    this.tree.store.read(async () => {
      task = read(new IDBReader(this.tree))
    })

    return yield* /** @type {any} */ (task)
  }

  /**
   * @type {Type.Store['write']}
   */
  *write(write) {
    let task
    this.tree.store.write(async () => {
      task = write(new IDBWriter(this.tree))
    })

    return yield* /** @type {any} */ (task)
  }

  *close() {}
}

class IDBReader {
  /**
   * @param {IDBTree} tree
   */
  constructor(tree) {
    this.tree = tree
  }
  *getRoot() {
    const root = yield* Task.wait(this.tree.getRoot())
    return root
  }
  /**
   * @param {number} level
   * @param {Uint8Array} key
   */
  *getNode(level, key) {
    const node = yield* Task.wait(this.tree.getNode(level, key))
    return node
  }
  /**
   * @param {number} level
   * @param {Uint8Array} key
   */
  *getChildren(level, key) {
    const children = yield* Task.wait(this.tree.getChildren(level, key))
    return children
  }
  /**
   * @param {Uint8Array} key
   */
  *get(key) {
    const value = yield* Task.wait(this.tree.get(key))
    return value
  }
  /**
   * @param {Type.Bound<Uint8Array>|null} [lowerBound]
   * @param {Type.Bound<Uint8Array>|null} [upperBound]
   * @param {{reverse?: boolean}} [options]
   */
  entries(lowerBound, upperBound, options) {
    return this.tree.entries(lowerBound, upperBound, options)
  }
  /**
   * @param {number} level
   * @param {Type.Bound<Type.Key>|null} [lowerBound]
   * @param {Type.Bound<Type.Key>|null} [upperBound]
   * @param {{reverse?: boolean}} [options]
   */
  nodes(level, lowerBound, upperBound, options) {
    return this.tree.nodes(level, lowerBound, upperBound, options)
  }
}

class IDBWriter extends IDBReader {
  /**
   * @param {Uint8Array} key
   */
  *delete(key) {
    return yield* Task.wait(this.tree.delete(key))
  }

  /**
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   */
  *set(key, value) {
    return yield* Task.wait(this.tree.set(key, value))
  }

  /**
   *
   * @param {Type.Change[]} changes
   */
  *integrate(changes) {
    const promises = []
    for (const [key, value] of changes) {
      if (value) {
        promises.push(this.tree.set(key, value))
      } else {
        promises.push(this.tree.delete(key))
      }
    }
    yield* Task.wait(Promise.all(promises))

    return yield* this.getRoot()
  }
}
