import * as Okra from '@canvas-js/okra'
import { Store, NodeStore } from './store.js'
import * as Type from '../../replica/type.js'
import { Task } from 'datalogia'
import { Reader } from './reader.js'
import { Writer } from './writer.js'

export class Tree {
  /**
   * Creates a new Tree instance from entries.
   * @param {Partial<Okra.Metadata>} init - Initial metadata.
   * @param {AsyncIterable<[Uint8Array, Okra.Leaf]>} entries - Entries to initialize the tree with.
   * @returns {Promise<Tree>} A promise that resolves to a new Tree.
   */
  static async fromEntries(init, entries) {
    const tree = new Tree(init)

    let success = false
    await tree.#queue.add(async () => {
      const store = new Store(tree.metadata, tree.#tree)
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

  /** @type {PQueue} */
  #queue = new PQueue({ concurrency: 1 })

  /** @type {boolean} */
  #open = true

  /**
   * @param {object} source
   * @param {string} source.storeName - The IndexedDB store name.
   * @param {IDBDatabase} source.db - The IndexedDB database.
   * @param {Partial<Okra.Metadata>} [source.options] - Initial metadata.
   */
  static *open({ db, storeName, options = {} }) {
    const {
      K = Okra.DEFAULT_K,
      Q = Okra.DEFAULT_Q,
      mode = Okra.Mode.Store,
    } = options
    const metadata = { K, Q, mode }

    const idb = new Store(db, storeName)
    const store = new NodeStore(metadata, idb)
    yield* store.initialize()

    return new this({
      store,
      metadata,
    })
  }

  /**
   * @param {object} source
   * @param {Okra.Metadata} source.metadata
   * @param {NodeStore} source.store
   */
  constructor({ metadata, store }) {
    this.metadata = metadata
    this.store = store
  }

  /**
   * Closes the tree, making it unusable for further operations.
   */
  *close() {
    this.#open = false
    await this.#queue.onIdle()

    return {}
  }

  /**
   * Clears the tree, removing all entries.
   */
  *clear() {
    if (this.#open === false) {
      throw new Error('tree closed')
    }

    yield* this.store.initialize()
  }

  /**
   * Performs a read operation on the tree.
   *
   * @template T
   * @param {(reader: Type.StoreReader) => Task.Task<T, Error>} job - The function to execute in a read transaction.
   * @returns {Task.Task<T, Error>} The result of the read operation.
   */
  read(job) {
    return job(new Reader(this.store))
  }

  /**
   * Performs a write operation on the tree.
   * @template T
   * @param {(writer: Type.StoreEditor) => Task.Task<T, Error>} job - The function to execute in a write transaction.
   * @returns {Task.Task<T, Error>} The result of the write operation.
   */
  write(job) {
    // TODO: queue write operations
    return job(new Writer(this.store))
  }
}
