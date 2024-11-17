import {
  assert,
  poll,
  parseEntry,
  createEntryKey,
  getLeafAnchorHash,
  map,
} from './util.js'
import { Task } from 'datalogia'
import * as Okra from '@canvas-js/okra'
import { KeyValueNodeStore } from '@canvas-js/okra'
import * as Type from '../../replica/type.js'
import { compare, equals, toString } from 'uint8arrays'

const Mode = /** @type {const} */ ({ Index: 0, Store: 1 })

export class Store {
  static magic = KeyValueNodeStore.magic
  static metadataKey = KeyValueNodeStore.metadataKey
  static anchorLeafKey = KeyValueNodeStore.anchorLeafKey

  db
  storeName
  /** @type {IDBTransaction|null} */
  txn = null
  /**
   * @param {IDBDatabase} db
   * @param {string} storeName
   */
  constructor(db, storeName) {
    this.db = db
    this.storeName = storeName
    this.oncomplete = this.oncomplete.bind(this)
  }

  oncomplete() {
    this.txn = null
  }

  /**
   * @param {IDBTransactionMode} mode
   */
  transaction(mode) {
    const transaction = this.db.transaction(this.storeName, mode)
    transaction.oncomplete = this.oncomplete
    return transaction
  }
  /**
   * @template T
   * @param {(store: IDBObjectStore) => Task.Task<T, Error>} job
   * @returns {Task.Task<T, Error>}
   */
  *write(job) {
    const txn = this.transaction('readwrite')
    try {
      txn.oncomplete = this.oncomplete
      this.txn = txn

      const result = yield* job(txn.objectStore(this.storeName))
      this.txn.commit()

      return result
    } catch (err) {
      console.error(err)
      txn.abort()
    } finally {
      this.txn = null
    }

    throw new Error('Should never have reached this point')
  }
  /**
   * @template T
   * @param {(store: IDBObjectStore) => Task.Task<T, Error>} job
   * @returns {Task.Task<T, Error>}
   */
  *read(job) {
    try {
      const txn = this.db.transaction(this.storeName, 'readonly')
      txn.oncomplete = this.oncomplete
      this.txn

      const result = yield* job(txn.objectStore(this.storeName))
      txn.commit()
      return result
    } finally {
      this.txn = null
    }
  }
  /**
   * @param {Uint8Array} key
   * @returns {Task.Task<Uint8Array|null, Error>}
   */
  get(key) {
    return this.read(function* (store) {
      const value = yield* poll(store.get(key))
      if (value === undefined) {
        return null
      } else if (value instanceof Uint8Array) {
        return value
      } else {
        throw new Error('Unexpected value type')
      }
    })
  }
  /**
   *
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   */
  set(key, value) {
    return this.write(function* (store) {
      return yield* poll(store.put(value, key))
    })
  }
  /**
   * @param {Uint8Array} key
   */
  *delete(key) {
    return this.write(function* (store) {
      return yield* poll(store.delete(key))
    })
  }
  /**
   *
   * @param {Okra.Bound<Uint8Array>|null} lowerBound
   * @param {Okra.Bound<Uint8Array>|null} upperBound
   * @param {{reverse?:boolean}} [options]
   */
  entries(lowerBound = null, upperBound = null, { reverse = false } = {}) {
    return new Iterator(
      this.db,
      this.storeName,
      lowerBound,
      upperBound,
      reverse
    )
  }
}

export class NodeStore {
  /**
   * @param {Okra.Metadata} metadata
   * @param {Store} store
   */
  constructor(metadata, store) {
    this.store = store
    this.metadata = metadata
  }

  *initialize() {
    const metadataValue = yield* this.store.get(KeyValueNodeStore.metadataKey)

    if (metadataValue === null) {
      this.setMetadata(this.metadata)
      this.setNode({ level: 0, key: null, hash: getLeafAnchorHash(this) })
      return
    }

    assert(metadataValue.byteLength >= 10, 'invalid metadata entry')

    const magic = metadataValue.subarray(0, 4)
    assert(equals(magic, KeyValueNodeStore.magic), 'invalid metadata entry')

    const version = metadataValue[4]
    assert(version === Okra.OKRA_VERSION, 'invalid okra version', {
      expected: Okra.OKRA_VERSION,
      actual: version,
    })

    const view = new DataView(
      metadataValue.buffer,
      metadataValue.byteOffset,
      metadataValue.byteLength
    )
    const K = metadataValue[5]
    const Q = view.getUint32(6)

    assert(K === this.metadata.K, 'metadata.K conflict')
    assert(Q === this.metadata.Q, 'metadata.Q conflict')

    // Due to a bug in a previous version of okra-js,
    // we have to handle the case where a v2 mode is
    // provided but metadataValue.byteLength is 10.
    if (metadataValue.byteLength === 10) {
      this.setMetadata(this.metadata)
      return
    }

    assert(metadataValue.byteLength === 11, 'invalid metadata entry')
    const mode = metadataValue[10]
    assert(mode === Mode.Index || mode === Mode.Store, 'invalid metadata entry')
    assert(mode === this.metadata.mode, 'metadata.mode conflict')
  }
  /**
   *
   * @param {Okra.Metadata} metadata
   */
  *setMetadata(metadata) {
    const buffer = new ArrayBuffer(11)
    const view = new DataView(buffer, 0, 11)
    const data = new Uint8Array(buffer, 0, 11)
    data.set(KeyValueNodeStore.magic)
    data[4] = Okra.OKRA_VERSION
    data[5] = metadata.K
    view.setUint32(6, metadata.Q)
    data[10] = metadata.mode
    yield* this.store.set(KeyValueNodeStore.metadataKey, data)
  }
  /**
   * Get the root node of the merkle tree. Returns the leaf anchor node if the tree is empty.
   *
   * @returns {Task.Task<Okra.Node, Error>}
   */
  *getRoot() {
    const upperBound = { key: KeyValueNodeStore.metadataKey, inclusive: false }
    const entries = this.store.entries(null, upperBound, { reverse: true })
    while (!entries.done) {
      const next = yield* entries.next()
      if (next.done) {
        break
      } else {
        const [key, value] = next.value
        const node = parseEntry(this, [key, value])
        assert(
          node.key === null,
          'Internal error: unexpected root node key',
          node
        )
        return node
      }
    }

    throw new Error('Internal error: empty node store')
  }

  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   * @returns {Task.Task<Okra.Node | null, Error>}
   */
  *getNode(level, key) {
    const entryKey = createEntryKey(level, key)
    const entryValue = yield* this.store.get(entryKey)
    return entryValue && parseEntry(this, [entryKey, entryValue])
  }

  /**
   * @param {Okra.Node} node
   */
  *setNode(node) {
    assert(node.hash.byteLength === this.metadata.K, 'node hash is not K bytes')

    const entryKey = createEntryKey(node.level, node.key)

    if (
      this.metadata.mode === Mode.Store &&
      node.level === 0 &&
      node.key !== null
    ) {
      assert(node.value !== undefined)
      const entryValue = new Uint8Array(
        new ArrayBuffer(this.metadata.K + node.value.byteLength)
      )
      entryValue.set(node.hash)
      entryValue.set(node.value, this.metadata.K)
      return yield* this.store.set(entryKey, entryValue)
    } else {
      assert(node.value === undefined)
      return yield* this.store.set(entryKey, node.hash)
    }
  }

  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   */
  *deleteNode(level, key) {
    const entryKey = createEntryKey(level, key)
    return yield* this.store.delete(entryKey)
  }

  /**
   *
   * @param {number} level
   * @param {Okra.Bound<Okra.Key> | null} [lowerBound]
   * @param {Okra.Bound<Okra.Key>|null} [upperBound]
   * @param {{reverse?:boolean}} [options]
   */
  nodes(level, lowerBound, upperBound, { reverse = false } = {}) {
    const lowerKeyBound = lowerBound
      ? {
          key: createEntryKey(level, lowerBound.key),
          inclusive: lowerBound.inclusive,
        }
      : { key: createEntryKey(level, null), inclusive: true }
    const upperKeyBound = upperBound
      ? {
          key: createEntryKey(level, upperBound.key),
          inclusive: upperBound.inclusive,
        }
      : { key: createEntryKey(level + 1, null), inclusive: false }

    const entries = this.store.entries(lowerKeyBound, upperKeyBound, {
      reverse,
    })

    return entries.map((entry) => parseEntry(this, entry))
  }
}

/**
 * @param {boolean} reverse
 */

const toIDBCursorDirection = (reverse) => (reverse ? 'prev' : 'next')
/**
 * @param {Okra.Bound<Uint8Array>|null} lowerBound
 * @param {Okra.Bound<Uint8Array>|null} upperBound
 * @returns {IDBKeyRange|null}
 */
const toIDBKeyRange = (lowerBound, upperBound) => {
  if (lowerBound && upperBound) {
    return IDBKeyRange.bound(
      lowerBound.key,
      upperBound.key,
      !lowerBound.inclusive,
      !upperBound.inclusive
    )
  } else if (lowerBound) {
    return IDBKeyRange.lowerBound(lowerBound.key, !lowerBound.inclusive)
  } else if (upperBound) {
    return IDBKeyRange.upperBound(upperBound.key, !upperBound.inclusive)
  } else {
    return null
  }
}

/**
 * @implements {AsyncIterable<[key:Uint8Array, value:Uint8Array]>}
 * @implements {Type.AwaitIterable<[key:Uint8Array, value:Uint8Array]>}
 */
class Iterator {
  /**
   * @param {IDBDatabase} db
   * @param {string} storeName
   * @param {Okra.Bound<Uint8Array>|null} lowerBound
   * * @param {Okra.Bound<Uint8Array>|null} upperBound
   * @param {boolean} reverse
   */
  constructor(db, storeName, lowerBound, upperBound, reverse) {
    this.db = db
    this.storeName = storeName
    this.lowerBound = lowerBound
    this.upperBound = upperBound
    this.position = null
    this.cursor = null
    this.reverse = reverse
    /** @type {IDBRequest<IDBCursorWithValue | null>|null} */
    this.request = null

    this.done = false
  }
  oncomplete() {
    this.cursor = null
    this.request = null
  }

  /**
   *
   * @returns {Task.Task<IteratorResult<[Uint8Array, Uint8Array]>, Error>}
   */
  *poll() {
    if (this.done) {
      return { done: true, value: undefined }
    }

    if (this.request == null) {
      const transaction = this.db.transaction(this.storeName, 'readonly')
      transaction.oncomplete = this.oncomplete
      transaction.onabort = this.oncomplete
      const store = transaction.objectStore(this.storeName)
      const range =
        this.position == null
          ? toIDBKeyRange(this.lowerBound, this.upperBound)
          : this.reverse
            ? toIDBKeyRange(this.lowerBound, this.position)
            : toIDBKeyRange(this.position, this.upperBound)

      this.request = store.openCursor(range, toIDBCursorDirection(this.reverse))
      this.cursor = yield* poll(this.request)
    } else if (this.cursor != null) {
      this.cursor.continue()
      this.cursor = yield* poll(this.request)
    }

    if (this.cursor != null) {
      const { key, value } = this.cursor
      assert(key instanceof Uint8Array, 'Unexpected cursor key type')
      assert(value instanceof Uint8Array, 'Unexpected cursor value type')

      // Update cursor to a new position so that on next poll we will continue
      // from where we left off.
      this.position = { key, inclusive: false }

      return { done: false, value: [key, value] }
    } else {
      return { done: true, value: undefined }
    }
  }
  next() {
    return Task.perform(this.poll())
  }
  async return() {
    this.done = true
    this.request?.transaction?.abort()

    return /** @type {const} */ ({ done: true, value: undefined })
  }
  [Symbol.asyncIterator]() {
    return this
  }

  /**
   * @template T
   * @param {(entry: [key: Uint8Array, value: Uint8Array]) => T} f
   * @returns {Type.AwaitIterable<T>}
   */
  map(f) {
    return map(this, f)
  }
}
