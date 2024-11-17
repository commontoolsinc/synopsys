import * as Okra from '@canvas-js/okra'
import { NodeStore } from './store.js'
import * as Type from '../../replica/type.js'
import { Task } from 'datalogia'
import { assert, map, equalKeys, isBoundary } from './util.js'

/**
 * Implementation of a read-only transaction.
 * @implements {Type.StoreReader}
 */
export class Reader {
  /**
   * Constructs a StoreReader implementation.
   *
   * @param {NodeStore} store - The node store associated with the transaction.
   */
  constructor(store) {
    this.store = store
    this.metadata = store.metadata
    this.limit = Number((1n << 32n) / BigInt(store.metadata.Q))
  }

  /**
   * Checks if a key exists in the store.
   * @param {Uint8Array} key - The key to check.
   * @returns {Task.Task<boolean, Error>} True if the key exists, false otherwise.
   */
  *has(key) {
    const leaf = yield* this.getNode(0, key)
    return leaf !== null
  }

  /**
   * Retrieves the value associated with a key.
   *
   * @param {Uint8Array} key - The key to retrieve.
   * @returns {Task.Task<Uint8Array | null, Error>} The value associated with the key, or null if not found.
   */
  *get(key) {
    assert(
      this.store.metadata.mode === Okra.Mode.Store,
      'get() can only be called on Store mode databases'
    )

    const leaf = yield* this.getNode(0, key)
    if (leaf === null) {
      return null
    }

    assert(leaf.value !== undefined, `expected leaf.value !== undefined`)
    return leaf.value
  }

  /**
   * Gets the root node of the tree.
   * @returns {Task.Task<Okra.Node, Error>} The root node.
   */
  getRoot() {
    return this.store.getRoot()
  }

  /**
   * Retrieves a node at a specific level and key.
   * @param {number} level - The level of the node.
   * @param {Okra.Key} key - The key of the node.
   * @returns {Task.Task<Okra.Node | null, Error>} The node, or null if not found.
   */
  getNode(level, key) {
    return this.store.getNode(level, key)
  }

  /**
   * Get the children of a node in the Merkle tree, identified by level and key.
   *
   * @param {number} level - The level of the node.
   * @param {Okra.Key} key - The key of the node.
   * @returns {Task.Task<Okra.Node[], RangeError>} The children nodes.
   */
  *getChildren(level, key) {
    if (level === 0) {
      throw new RangeError('Cannot get children of a leaf node')
    }

    const children = []
    const nodes = this.store.nodes(level - 1, { key, inclusive: true })
    while (true) {
      const next = yield* nodes.poll()
      if (next.done) {
        break
      }

      const node = next.value
      if (isBoundary(this, node) && !equalKeys(node.key, key)) {
        break
      } else {
        children.push(node)
      }
    }

    return children
  }

  /**
   * Iterates over nodes at a specific level.
   * @param {number} level - The level of the nodes.
   * @param {Okra.Bound<Okra.Key> | null} [lowerBound] - The lower bound.
   * @param {Okra.Bound<Okra.Key> | null} [upperBound] - The upper bound.
   * @param {Object} [options] - Additional options.
   * @param {boolean} [options.reverse] - Whether to iterate in reverse order.
   * @returns {Type.AwaitIterable<Okra.Node>} An iterator for the nodes.
   */
  nodes(level, lowerBound = null, upperBound = null, options = {}) {
    return this.store.nodes(level, lowerBound, upperBound, options)
  }

  /**
   * Iterates over keys in the store.
   *
   * @param {Okra.Bound<Uint8Array> | null} [lowerBound=null] - The lower bound.
   * @param {Okra.Bound<Uint8Array> | null} [upperBound=null] - The upper bound.
   * @param {Object} [options={}] - Additional options.
   * @param {boolean} [options.reverse] - Whether to iterate in reverse order.
   * @returns {Type.AwaitIterable<Uint8Array>} An iterator for the keys.
   */
  keys(lowerBound = null, upperBound = null, options = {}) {
    const nodes = this.nodes(
      0,
      lowerBound ?? { key: null, inclusive: false },
      upperBound,
      options
    )

    return map(nodes, (node) => /** @type {Uint8Array} */ (node.key))
  }

  /**
   * Iterates over entries in the store.
   * @param {Okra.Bound<Uint8Array> | null} [lowerBound=null] - The lower bound.
   * @param {Okra.Bound<Uint8Array> | null} [upperBound=null] - The upper bound.
   * @param {Object} [options={}] - Additional options.
   * @param {boolean} [options.reverse] - Whether to iterate in reverse order.
   * @returns {Type.AwaitIterable<Okra.Entry>} An iterator for the entries.
   * @throws {Error} If the mode is not Store.
   */
  entries(lowerBound = null, upperBound = null, options = {}) {
    assert(
      this.store.metadata.mode === Okra.Mode.Store,
      '.entries() requires Mode.Store'
    )
    const nodes = this.nodes(
      0,
      lowerBound ?? { key: null, inclusive: false },
      upperBound,
      options
    )

    return map(nodes, (node) => {
      assert(node.key !== null)
      assert(node.value !== undefined)
      return [node.key, node.value]
    })
  }
}
