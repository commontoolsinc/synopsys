import * as Okra from '@canvas-js/okra'
import { compare } from 'uint8arrays'
import * as IDB from 'idb'
import * as Type from '../replica/type.js'
import { Task } from 'datalogia'
import { assert, equalKeys, lessThan } from "./utils.js";

import {
  // Awaitable,
  // ReadOnlyTransaction,
  // ReadWriteTransaction,
  ReadOnlyTransactionImpl,
  createEntryKey,
  ReadWriteTransactionImpl,
  KeyValueNodeStore,
  // Tree as Tree,
  // Leaf,/** @typedef {import('@canvas-js/okra').Leaf} Leaf */
  Mode,
  // Metadata,
  DEFAULT_K,
  DEFAULT_Q,
  Builder,
} from '@canvas-js/okra'
import { createEntryKey } from '@canvas-js/okra/utils'
import PQueue from 'p-queue'

KeyValueNodeStore.prototype.parseEntryKey

/**
 * @implements {Okra.SyncSource}
 */
class SyncSource {
  constructor() {}
}


/**
 * @param {object} self 
 * @param {Okra.Metadata} self.metadata
 * @param {Okra.Entry} entry
 * @returns {Okra.Node}
 */
const parseEntry = (self, entry) =>
  // @ts-expect-error - typed as private method
  KeyValueNodeStore.prototype.parseEntry.call(self, entry)


/**
 * @template {string} StoreName
 * @typedef {{[K in StoreName]: {key: Uint8Array, value: Uint8Array}}} DBSchema
 * 
 */
/**
 * @template {string} StoreName
 * @implements {Type.StoreReader}
 * @implements {Type.PullTarget}
 */
class Reader {
  parseEntry =
    // @ts-expect-error
    KeyValueNodeStore.prototype.parseEntry


  /**
   * @param {object} source
   * @param {Okra.Metadata} source.metadata
   * @param {IDB.IDBPTransaction<DBSchema<StoreName>>} source.transaction
   * @param {IDB.StoreNames<DBSchema<StoreName>>} source.storeName
   */
  constructor({transaction, storeName}) {
    this.metadata = metadata
    this.transaction = transaction
    this.storeName = storeName
    this.store = transaction.objectStore(storeName)

    
  }
    /**
   * Get an iterator for the entries in the store.
   * @param {Okra.Bound<Uint8Array> | null} [lowerBound=null] - The lower bound for entries.
   * @param {Okra.Bound<Uint8Array> | null} [upperBound=null] - The upper bound for entries.
   * @param {Object} [options={}] - Additional options.
   * @param {boolean} [options.reverse=false] - Whether to iterate in reverse order.
   * @returns {Type.AwaitIterable<Okra.Entry>} An iterator for the entries.
   */
  async * entries(lowerBound = null, upperBound = null, { reverse = false } = {}) {
    let query = null;
    if (lowerBound && upperBound) {
        query = IDBKeyRange.bound(lowerBound.key, upperBound.key, !lowerBound.inclusive, !upperBound.inclusive);
    }
    else if (lowerBound) {
        query = IDBKeyRange.lowerBound(lowerBound.key, !lowerBound.inclusive);
    }
    else if (upperBound) {
        query = IDBKeyRange.upperBound(upperBound.key, !upperBound.inclusive);
    }
    assert(this.transaction !== null, "Internal error: this.transaction !== null");
    const store = this.store
    let cursor = await store.openCursor(query, reverse ? "prev" : "next");
    while (cursor !== null) {
        let key = null;
        if (cursor.key instanceof Uint8Array) {
            key = cursor.key;
        }
        else if (cursor.key instanceof ArrayBuffer) {
            key = new Uint8Array(cursor.key);
        }
        else {
            throw new Error("Unexpected cursor key type");
        }
        if (cursor.value instanceof Uint8Array) {
            yield /** @type {Okra.Entry} */([key, cursor.value]);
        }
        else {
            throw new Error("Unexpected cursor value type");
        }
        cursor = await cursor.continue();
    }
  }
  * getRoot() {
    const upperBound = { key: KeyValueNodeStore.metadataKey, inclusive: false };
    const entries = this.entries(null, upperBound, { reverse: true });
    while (true) {
      const next = yield* Task.wait(entries.next())
      if (next.done) {
        break
      }

      const node = parseEntry(this, next.value)
      assert(node.key === null, "Internal error: unexpected root node key", node);
      return node
    }
    throw new Error("Internal error: empty node store");
  }

  /**
   * 
   * @param {number} level 
   * @param {Uint8Array} key 
   */
  * getNode(level, key) {
  const entryKey = createEntryKey(level, key);
  }

  /**
   * 
   * @param {Okra.Entry} entry
   * @returns {Okra.Node}
   */
  parseEntry([entryKey, entryValue]) {
		const { K, mode } = this.metadata

		const [level, key] = parseEntryKey(entryKey)

		assert(entryValue.byteLength >= K, "entry value is less than K bytes")

		const hash = entryValue.subarray(0, K)

		if (mode === Mode.Store && level === 0 && key !== null) {
			return { level, key, hash, value: entryValue.subarray(K) }
		} else {
			return { level, key, hash }
		}
	}



  /**
   * 
   * @param {number} level 
   * @param {Uint8Array} key 
   */
  *getChildren(level, key) {
    return []
  }

  /**
   * 
   * @param {number} level 
   * @param {Okra.Bound<Okra.Key>|null} [lowerBound] 
   * @param {Okra.Bound<Okra.Key>|null} [upperBound] 
   * @param {{reverse?: boolean}} [options] 
   * @returns {Type.AwaitIterable<Type.Node>}
   */
  nodes(level, lowerBound, upperBound, options) {
    return [].values()
  }
  /**
   * @param {Uint8Array} key
   */
  get(key) {

  }
  /**
   * @param {Uint8Array} key
   */
}

/**
 * @implements {Type.StoreEditor}
 */
class Editor {
  /**
   *
   * @param {Uint8Array} key
   */
  *delete(key) {}
  /**
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   */
  *set(key, value) {}

  *integrate(changes: Type.Change[]) {
  }
}

/**
 * @implements {Okra.Tree}
 */
export class Tree {
  #tree
  /**
   *
   * @param {Partial<Okra.Metadata>} init
   * @param {AsyncIterable<[Uint8Array, Okra.Leaf]>} entries
   * @returns {Promise<Tree>}
   */
  static async fromEntries(init, entries) {
    const tree = new Tree(init)

    let success = false
    await tree.#queue.add(async () => {
      const store = new NodeStore(tree.metadata, tree.#tree)
      await Builder.fromEntriesAsync(store, entries)
      tree.#tree = store.snapshot
      success = true
    })

    if (!success) {
      throw new Error('failed to commit transaction')
    }

    return tree
  }

  /** @type {Okra.Metadata} */
  metadata

  #queue = new PQueue({ concurrency: 1 })
  #open = true

  /**
   *
   * @param {object} source
   * @param {IDB.IDBPDatabase} source.db
   * @param {string} source.storeName
   * @param {Partial<Okra.Metadata>} [source.options]
   */
  constructor({ db, storeName, options = {} }) {
    const { K = DEFAULT_K, Q = DEFAULT_Q, mode = Mode.Store } = init
    this.metadata = { K, Q, mode }
    this.db = db
    this.storeName = storeName

    const store = new NodeStore(this.metadata, this.#tree)
    store.initialize()
    this.#tree = store.snapshot
  }

  /**
   * @returns {Promise<void>}
   */
  async close() {
    this.#open = false
    await this.#queue.onIdle()
    this.#tree = createTree(compare)
  }

  /**
   * @returns {void}
   */
  clear() {
    if (this.#open === false) {
      throw new Error('tree closed')
    }

    const store = new NodeStore(this.metadata)
    store.initialize()
    this.#tree = store.snapshot
  }

  /**
   * @template T
   * @param {(tx: Okra.ReadOnlyTransaction) => Okra.Awaitable<T>} callback
   * @returns {Promise<T>}
   */
  async read(callback) {
    const transaction = this.db.transaction(this.storeName, 'readonly')

    if (this.#open === false) {
      throw new Error('tree closed')
    }

    const store = new NodeStore(this.metadata, this.#tree)
    return await callback(new ReadOnlyTransactionImpl(store))
  }

  /**
   * @template T
   * @param {(tx: Okra.ReadWriteTransaction) => Okra.Awaitable<T>} callback
   * @returns {Promise<T>}
   */
  async write(callback) {
    if (this.#open === false) {
      throw new Error('tree closed')
    }

    let success = false
    /** @type {T|undefined} */
    let result = undefined
    const store = new NodeStore(this.metadata, this.#tree)
    await this.#queue.add(async () => {
      const store = new NodeStore(this.metadata, this.#tree)
      result = await callback(new ReadWriteTransactionImpl(store))
      success = true
      this.#tree = store.snapshot
    })

    if (!success) {
      throw new Error('failed to commit transaction')
    }

    return /** @type {T} */ (result)
  }
}

// // Assuming KeyValueNodeStore, createTree, compare, Metadata, Tree, Bound, and Entry are defined elsewhere

// const createReadOnlyTransaction = () => {}
// /**
//  * Represents a store for nodes with key-value pairs.
//  * @extends KeyValueNodeStore
//  */
// class NodeStore extends KeyValueNodeStore {
//   /**
//    * @param {object} source
//    * @param {Okra.Metadata} source.metadata - Metadata for the node store.
//    * @param {IDB.IDBPTransaction} source.transaction
//    * @param {string} source.storeName
//    */
//   constructor({ metadata, transaction, storeName }) {
//     super()
//     /** @readonly */
//     this.metadata = metadata
//     this.transaction = transaction
//     this.storeName = storeName
//     this.store = transaction.objectStore(this.storeName)
//   }

//   /**
//    * Get the value associated with a key.
//    * @param {Uint8Array} key - The key to search for.
//    * @returns {Promise<Uint8Array | null>} The value associated with the key, or null if not found.
//    * @protected
//    */
//   async get(key) {
//     const value = await this.store.get(key)
//     if (value === undefined) {
//       return null
//     } else if (value instanceof Uint8Array) {
//       return value
//     } else {
//       throw new Error('Unexpected value type')
//     }
//   }

//   /**
//    * Set the value for a key.
//    * @param {Uint8Array} key - The key to set.
//    * @param {Uint8Array} value - The value to associate with the key.
//    * @protected
//    */
//   set(key, value) {
//     if (this.snapshot.get(key) !== undefined) {
//       this.snapshot = this.snapshot.remove(key)
//     }
//     this.snapshot = this.snapshot.insert(key, value)
//   }

//   /**
//    * Delete a key from the store.
//    * @param {Uint8Array} key - The key to delete.
//    * @protected
//    */
//   delete(key) {
//     this.snapshot = this.snapshot.remove(key)
//   }

//   /**
//    * Get an iterator for the keys in the store.
//    * @param {Okra.Bound<Uint8Array> | null} [upperBound=null] - The upper bound for keys.
//    * @param {Okra.Bound<Uint8Array> | null} [lowerBound=null] - The lower bound for keys.
//    * @param {Object} [options={}] - Additional options.
//    * @param {boolean} [options.reverse=false] - Whether to iterate in reverse order.
//    * @returns {IterableIterator<Uint8Array>} An iterator for the keys.
//    * @protected
//    */
//   *keys(lowerBound = null, upperBound = null, { reverse = false } = {}) {
//     for (const [key] of this.entries(lowerBound, upperBound, { reverse })) {
//       yield key
//     }
//   }

//   /**
//    * Get an iterator for the entries in the store.
//    * @param {Okra.Bound<Uint8Array> | null} [lowerBound=null] - The lower bound for entries.
//    * @param {Okra.Bound<Uint8Array> | null} [upperBound=null] - The upper bound for entries.
//    * @param {Object} [options={}] - Additional options.
//    * @param {boolean} [options.reverse=false] - Whether to iterate in reverse order.
//    * @returns {IterableIterator<Okra.Entry>} An iterator for the entries.
//    * @protected
//    */
//   *entries(lowerBound = null, upperBound = null, { reverse = false } = {}) {
//     if (reverse === false) {
//       const iter =
//         lowerBound === null
//           ? this.snapshot.begin
//           : lowerBound.inclusive
//             ? this.snapshot.ge(lowerBound.key)
//             : this.snapshot.gt(lowerBound.key)

//       while (iter.valid && NodeStore.isBelow(iter.key, upperBound)) {
//         yield [iter.key, iter.value]
//         iter.next()
//       }
//     } else {
//       const iter =
//         upperBound === null
//           ? this.snapshot.end
//           : upperBound.inclusive
//             ? this.snapshot.le(upperBound.key)
//             : this.snapshot.lt(upperBound.key)

//       while (iter.valid && NodeStore.isAbove(iter.key, lowerBound)) {
//         yield [iter.key, iter.value]
//         iter.prev()
//       }
//     }
//   }

//   /**
//    * Check if a key is above a lower bound.
//    * @param {Uint8Array} key - The key to check.
//    * @param {Bound<Uint8Array> | null} lowerBound - The lower bound.
//    * @returns {boolean} True if the key is above the lower bound.
//    * @private
//    */
//   static isAbove(key, lowerBound) {
//     if (lowerBound === null) {
//       return true
//     } else if (lowerBound.inclusive) {
//       return compare(key, lowerBound.key) >= 0
//     } else {
//       return compare(key, lowerBound.key) === 1
//     }
//   }

//   /**
//    * Check if a key is below an upper bound.
//    * @param {Uint8Array} key - The key to check.
//    * @param {Bound<Uint8Array> | null} upperBound - The upper bound.
//    * @returns {boolean} True if the key is below the upper bound.
//    * @private
//    */
//   static isBelow(key, upperBound) {
//     if (upperBound === null) {
//       return true
//     } else if (upperBound.inclusive) {
//       return compare(key, upperBound.key) <= 0
//     } else {
//       return compare(key, upperBound.key) === -1
//     }
//   }
// }

// export default NodeStore
