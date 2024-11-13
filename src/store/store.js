import * as Type from './type.js'
import * as Okra from '@canvas-js/okra'
import { Task } from 'datalogia'

/**
 * @implements {Type.Store}
 */
export class Sync {
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
      Task.perform(read(new SyncReader(reader)))
    )
    return yield* Task.wait(result)
  }

  /**
   * @type {Type.Store['write']}
   */
  *write(write) {
    const result = this.tree.write((writer) =>
      Task.perform(write(new SyncWriter(writer)))
    )
    return yield* Task.wait(result)
  }

  *close() {
    return yield* Task.wait(this.tree.close())
  }
}

export class SyncReader {
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

  /** @type {Type.Reader['entries']}  */
  entries(lowerBound, upperBound, options) {
    return this.transaction.entries(lowerBound, upperBound, options)
  }
  /** @type {Type.Reader['nodes']}  */
  nodes(level, lowerBound, upperBound, options) {
    return this.transaction.nodes(level, lowerBound, upperBound, options)
  }
}

/**
 * @implements {Type.Editor}
 */
export class SyncWriter extends SyncReader {
  /**
   * @param {Type.ReadWriteTransaction} transaction
   */
  constructor(transaction) {
    super(transaction)
    this.transaction = transaction
  }
  /** @type {Type.Writer['delete']} */
  *delete(key) {
    return this.transaction.delete(key)
  }
  /** @type {Type.Writer['set']} */
  *set(key, value) {
    return this.transaction.set(key, value)
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

/**
 * @implements {Type.Store}
 */
export class Async {
  /**
   * @param {Type.AsyncSource} source
   */
  constructor(source) {
    this.source = source
  }

  /**
   * @type {Type.Store['read']}
   */
  read(read) {
    return read(new AsyncReader(this.source))
  }

  /**
   * @type {Type.Store['write']}
   */
  write(write) {
    return write(new AsyncWriter(this.source))
  }

  *close() {
    if (this.source.close) {
      return yield* Task.wait(this.source.close())
    }
  }
}

/**
 * @implements {Type.Reader}
 */
class AsyncReader {
  /**
   * @param {Type.AsyncSource} source
   */
  constructor(source) {
    this.source = source
  }
  *getRoot() {
    const root = yield* Task.wait(this.source.getRoot())
    return root
  }
  /**
   * @param {number} level
   * @param {Uint8Array} key
   */
  *getNode(level, key) {
    const node = yield* Task.wait(this.source.getNode(level, key))
    return node
  }
  /**
   * @param {number} level
   * @param {Uint8Array} key
   */
  *getChildren(level, key) {
    const children = yield* Task.wait(this.source.getChildren(level, key))
    return children
  }
  /**
   * @param {Uint8Array} key
   */
  *get(key) {
    const value = yield* Task.wait(this.source.get(key))
    return value
  }
  /**
   * @param {Type.Bound<Uint8Array>|null} [lowerBound]
   * @param {Type.Bound<Uint8Array>|null} [upperBound]
   * @param {{reverse?: boolean}} [options]
   */
  entries(lowerBound, upperBound, options) {
    return this.source.entries(lowerBound, upperBound, options)
  }
  /**
   * @param {number} level
   * @param {Type.Bound<Type.Key>|null} [lowerBound]
   * @param {Type.Bound<Type.Key>|null} [upperBound]
   * @param {{reverse?: boolean}} [options]
   */
  nodes(level, lowerBound, upperBound, options) {
    return this.source.nodes(level, lowerBound, upperBound, options)
  }
}

/**
 * @implements {Type.Writer}
 */
class AsyncWriter extends AsyncReader {
  /**
   * @param {Uint8Array} key
   */
  *delete(key) {
    return yield* Task.wait(this.source.delete(key))
  }
  /**
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   */
  *set(key, value) {
    return yield* Task.wait(this.source.set(key, value))
  }

  /**
   *
   * @param {Type.Change[]} changes
   */
  *integrate(changes) {
    const promises = []
    for (const [key, value] of changes) {
      if (value) {
        promises.push(this.source.set(key, value))
      } else {
        promises.push(this.source.delete(key))
      }
    }
    yield* Task.wait(Promise.all(promises))

    return yield* this.getRoot()
  }
}
