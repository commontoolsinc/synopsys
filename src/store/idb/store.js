import {
  assert,
  poll,
  parseEntry,
  createEntryKey,
  getLeafAnchorHash,
} from './util.js'
import { map, end } from '../sequence.js'
import * as Task from '../../task.js'
import * as Okra from '@canvas-js/okra'
import { KeyValueNodeStore } from '@canvas-js/okra'
import * as Type from '../../replica/type.js'
import { equals } from 'uint8arrays'

const Mode = /** @type {const} */ ({ Index: 0, Store: 1 })

/**
 * @typedef {object} IDBSession
 * @property {IDBObjectStore} store
 * @property {IDBTransaction} transaction
 */

export class StoreSession {
  static magic = KeyValueNodeStore.magic
  static metadataKey = KeyValueNodeStore.metadataKey
  static anchorLeafKey = KeyValueNodeStore.anchorLeafKey

  /** @type {IDBSession|null} */
  #session
  /**
   * @param {IDBSession} session
   */
  constructor(session) {
    this.close = this.close.bind(this)
    session.transaction.oncomplete = this.close
    this.#session = session
  }
  close() {
    this.#session = null
  }

  get session() {
    if (this.#session) {
      return this.#session
    } else {
      throw new Error(`Transaction session is closed`)
    }
  }

  /**
   * @param {Uint8Array} key
   * @returns {Task.Task<Uint8Array|null, Error>}
   */
  *get(key) {
    const value = yield* poll(this.session.store.get(key))
    if (value === undefined) {
      return null
    } else if (value instanceof Uint8Array) {
      return value
    } else {
      throw new Error('Unexpected value type')
    }
  }
  /**
   *
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   */
  *set(key, value) {
    return yield* poll(this.session.store.put(value, key))
  }
  /**
   * @param {Uint8Array} key
   */
  *delete(key) {
    return yield* poll(this.session.store.delete(key))
  }
  /**
   *
   * @param {Okra.Bound<Uint8Array>|null} lowerBound
   * @param {Okra.Bound<Uint8Array>|null} upperBound
   * @param {{reverse?:boolean}} [options]
   * @returns {Type.Sequence<[key:Uint8Array, value:Uint8Array]>}
   */
  entries(lowerBound = null, upperBound = null, { reverse = false } = {}) {
    const range = toIDBKeyRange(lowerBound, upperBound)
    const direction = toIDBCursorDirection(reverse)
    const request = this.session.store.openCursor(range, direction)
    return new Entries(this, request)
  }

  *clear() {
    yield* poll(this.session.store.clear())
    return {}
  }
}

/**
 * @implements {Type.Sequence<[key: Uint8Array, value: Uint8Array]>}
 */

class Entries {
  /**
   * @param {StoreSession} store
   * @param {IDBRequest<IDBCursorWithValue | null>} request
   */
  constructor(store, request) {
    this.store = store
    this.request = request
    /** @type {IDBCursorWithValue | null} */
    this.cursor = null

    this.done = false
  }
  get session() {
    return this.store.session
  }

  /**
   * @returns {Task.Task<Type.Result<[key:Uint8Array, value:Uint8Array], Type.IterationFinished>, Error>}
   */
  *next() {
    if (this.done) {
      return end()
    }

    if (this.cursor != null) {
      this.cursor.continue()
    }
    const cursor = yield* poll(this.request)
    this.cursor = cursor
    if (cursor == null) {
      this.done = true
      return end()
    } else {
      const { value } = cursor
      const { key } =
        cursor.key instanceof ArrayBuffer
          ? { key: new Uint8Array(cursor.key) }
          : cursor
      assert(key instanceof Uint8Array, 'Unexpected cursor key type')
      assert(value instanceof Uint8Array, 'Unexpected cursor value type')
      return { ok: [key, value] }
    }
  }
}

export class NodeStore {
  /**
   * @param {Okra.Metadata} metadata
   * @param {StoreSession} session
   */
  constructor(metadata, session) {
    this.session = session
    this.metadata = metadata
  }

  *initialize() {
    const metadataValue = yield* this.session.get(KeyValueNodeStore.metadataKey)

    if (metadataValue === null) {
      yield* this.setMetadata(this.metadata)
      yield* this.setNode({
        level: 0,
        key: null,
        hash: getLeafAnchorHash(this),
      })
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
      yield* this.setMetadata(this.metadata)
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
    yield* this.session.set(KeyValueNodeStore.metadataKey, data)
  }
  /**
   * Get the root node of the merkle tree. Returns the leaf anchor node if the tree is empty.
   *
   * @returns {Task.Task<Okra.Node, Error>}
   */
  *getRoot() {
    const upperBound = { key: KeyValueNodeStore.metadataKey, inclusive: false }
    const entries = this.session.entries(null, upperBound, { reverse: true })
    while (true) {
      const next = yield* entries.next()
      if (next.error) {
        break
      } else {
        const [key, value] = next.ok
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
    const entryValue = yield* this.session.get(entryKey)
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
      return yield* this.session.set(entryKey, entryValue)
    } else {
      assert(node.value === undefined)
      return yield* this.session.set(entryKey, node.hash)
    }
  }

  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   */
  *deleteNode(level, key) {
    const entryKey = createEntryKey(level, key)
    return yield* this.session.delete(entryKey)
  }

  /**
   *
   * @param {number} level
   * @param {Okra.Bound<Okra.Key> | null} [lowerBound]
   * @param {Okra.Bound<Okra.Key>|null} [upperBound]
   * @param {{reverse?:boolean}} [options]
   * @returns {Type.Sequence<Okra.Node>}
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

    const entries = this.session.entries(lowerKeyBound, upperKeyBound, {
      reverse,
    })

    return map(entries, (entry) => parseEntry(this, entry))
  }

  *clear() {
    return yield* this.session.clear()
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
