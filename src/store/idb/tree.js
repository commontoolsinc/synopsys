import * as Okra from '@canvas-js/okra'
import { StoreSession, NodeStore } from './store.js'
import * as Type from '../../replica/type.js'
import * as Task from '../../task.js'
import { Reader } from './reader.js'
import { Writer } from './writer.js'

/**
 * @param {object} source
 * @param {string} source.storeName - The IndexedDB store name.
 * @param {IDBDatabase} source.db - The IndexedDB database.
 * @param {Partial<Okra.Metadata>} [source.options] - Initial metadata.
 */
export function* open({ db, storeName, options = {} }) {
  const {
    K = Okra.DEFAULT_K,
    Q = Okra.DEFAULT_Q,
    mode = Okra.Mode.Store,
  } = options
  const metadata = { K, Q, mode }

  const transaction = db.transaction(storeName, 'readwrite')
  const session = new StoreSession({
    transaction,
    store: transaction.objectStore(storeName),
  })

  const store = new NodeStore(metadata, session)
  yield* store.initialize()

  return new Tree({
    db,
    storeName,
    metadata,
  })
}

/**
 * @implements {Type.Store}
 */
export class Tree {
  /** @type {Okra.Metadata} */
  metadata

  #queue = Task.queue()

  /** @type {boolean} */
  #open = true

  /**
   * @param {object} source
   * @param {Okra.Metadata} source.metadata
   * @param {IDBDatabase} source.db
   * @param {string} source.storeName
   */
  constructor({ metadata, storeName, db }) {
    this.metadata = metadata
    this.db = db
    this.storeName = storeName
  }

  /**
   * Closes the tree, making it unusable for further operations.
   */
  *close() {
    this.#open = false
    return yield* this.#queue.spawn(function* () {
      return {}
    })
  }

  /**
   * Clears the tree, removing all entries.
   */
  *clear() {
    if (this.#open === false) {
      throw new Error('tree closed')
    }

    const { db, storeName, metadata } = this

    return yield* this.#queue.spawn(function* () {
      const transaction = db.transaction(storeName, 'readwrite')
      const session = new StoreSession({
        transaction,
        store: transaction.objectStore(storeName),
      })
      return yield* session.clear()
    })
  }

  /**
   * Performs a read operation on the tree.
   *
   * @template T
   * @template {Error} X
   * @param {(reader: Type.StoreReader) => Task.Task<T, X>} job - The function to execute in a read transaction.
   * @returns {Task.Task<T, X>} The result of the read operation.
   */
  *read(job) {
    if (this.#open === false) {
      throw new Error('Tree is closed')
    }

    const transaction = this.db.transaction(this.storeName, 'readonly')
    const session = new StoreSession({
      transaction,
      store: transaction.objectStore(this.storeName),
    })

    const store = new NodeStore(this.metadata, session)
    return yield* job(new Reader(store))
  }

  /**
   * Performs a write operation on the tree.
   * @template T
   * @template {Error} X
   * @param {(writer: Type.StoreEditor) => Task.Task<T, X>} job - The function to execute in a write transaction.
   * @returns {Task.Task<T, X>} The result of the write operation.
   */
  write(job) {
    if (this.#open === false) {
      throw new Error(`Tree is closed`)
    }

    const { db, storeName, metadata } = this

    return this.#queue.spawn(function* () {
      const transaction = db.transaction(storeName, 'readwrite')
      const session = new StoreSession({
        transaction,
        store: transaction.objectStore(storeName),
      })

      const store = new NodeStore(metadata, session)
      const result = yield* job(new Writer(store))
      yield* commit(transaction)
      return result
    })
  }
}

/**
 * @param {IDBTransaction} transaction
 */
function* commit(transaction) {
  const invocation = Task.perform(Task.suspend())

  const onCommit = () => {
    transaction.removeEventListener('complete', onCommit)
    invocation.abort(Task.RESUME)
  }
  transaction.addEventListener('complete', onCommit)

  transaction.commit()

  yield* Task.result(invocation)
}
