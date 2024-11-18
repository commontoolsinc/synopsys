import * as Type from './type.js'
import * as Okra from '@canvas-js/okra'
import * as Task from '../task.js'
import { end } from './sequence.js'

/**
 * @param {Okra.Tree} tree
 */
export const from = (tree) => new Store(tree)

/**
 * @implements {Type.Store}
 */
export class Store {
  /**
   * @param {Okra.Tree} tree
   */
  constructor(tree) {
    this.tree = tree
  }

  /**
   * @type {Type.Store['read']}
   */
  *read(read) {
    const result = this.tree.read((reader) =>
      Task.perform(read(new Reader(reader)))
    )
    return yield* Task.wait(result)
  }

  /**
   * @type {Type.Store['write']}
   */
  *write(write) {
    const result = this.tree.write((writer) =>
      Task.perform(write(new Writer(writer)))
    )
    return yield* Task.wait(result)
  }

  *close() {
    yield* Task.wait(this.tree.close())
    return {}
  }

  *clear() {
    yield* Task.wait(this.tree.clear())
    return {}
  }
}

export class Reader {
  /**
   * @param {Type.ReadOnlyTransaction} transaction
   */
  constructor(transaction) {
    this.transaction = transaction
  }
  *getRoot() {
    return this.transaction.getRoot()
  }

  /**
   * @param {number} level
   * @param {Uint8Array} key
   */
  *getNode(level, key) {
    return this.transaction.getNode(level, key)
  }
  /**
   * @param {number} level
   * @param {Uint8Array} key
   */
  *getChildren(level, key) {
    return this.transaction.getChildren(level, key)
  }
  /**
   * @param {Uint8Array} key
   */
  *get(key) {
    return this.transaction.get(key)
  }

  /** @type {Type.StoreReader['entries']}  */
  entries(lowerBound, upperBound, options) {
    return new Sequence(
      this.transaction.entries(lowerBound, upperBound, options)
    )
  }
  /** @type {Type.StoreReader['nodes']}  */
  nodes(level, lowerBound, upperBound, options) {
    return new Sequence(
      this.transaction.nodes(level, lowerBound, upperBound, options)
    )
  }
}

/**
 * @template T
 * @implements {Type.Sequence<T>}
 */
export class Sequence {
  /**
   * @param {IterableIterator<T>} source
   */
  constructor(source) {
    this.source = source
  }
  *next() {
    const next = this.source.next()
    if (next.done) {
      return end()
    } else {
      return { ok: next.value }
    }
  }
}

/**
 * @implements {Type.StoreEditor}
 */
export class Writer extends Reader {
  /**
   * @param {Type.ReadWriteTransaction} transaction
   */
  constructor(transaction) {
    super(transaction)
    this.transaction = transaction
  }
  /** @type {Type.StoreWriter['delete']} */
  *delete(key) {
    this.transaction.delete(key)
    return {}
  }
  /** @type {Type.StoreWriter['set']} */
  *set(key, value) {
    this.transaction.set(key, value)
    return {}
  }

  /**
   *
   * @param {Type.Change[]} changes
   */
  *integrate(changes) {
    for (const [key, value] of changes) {
      if (value) {
        this.transaction.set(key, value)
      } else {
        this.transaction.delete(key)
      }
    }

    return yield* this.getRoot()
  }
}
