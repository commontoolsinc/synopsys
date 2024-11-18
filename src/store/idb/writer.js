import * as Okra from '@canvas-js/okra'
import { NodeStore } from './store.js'
import * as Type from '../../replica/type.js'
import * as Task from '../../task.js'
import { hashEntry, compareKeys, isBoundary } from './util.js'
import { Reader } from './reader.js'
import { equals } from 'uint8arrays'
import { blake3 } from '@noble/hashes/blake3'

/**
 * @implements {Type.StoreEditor}
 */
export class Writer extends Reader {
  /**
   *
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   */
  *set(key, value) {
    const hash = hashEntry(key, value, this.store.metadata)

    const oldLeaf = yield* this.getNode(0, key)

    if (oldLeaf !== null && equals(oldLeaf.hash, hash)) {
      return {}
    }

    const { mode } = this.store.metadata
    if (mode === Okra.Mode.Index) {
      yield* this.replace(oldLeaf, { level: 0, key, hash })
    } else if (mode === Okra.Mode.Store) {
      yield* this.replace(oldLeaf, { level: 0, key, hash, value })
    } else {
      throw new Error('invalid mode')
    }

    return {}
  }

  /**
   * @param {Type.Change[]} changes
   */
  *integrate(changes) {
    for (const [key, value] of changes) {
      if (value) {
        yield* this.set(key, value)
      } else {
        yield* this.delete(key)
      }
    }

    return yield* this.getRoot()
  }

  /**
   * @param {Uint8Array} key
   * @returns {Task.Task<{}, Error>}
   */
  *delete(key) {
    const node = yield* this.getNode(0, key)
    if (node === null) {
      return {}
    }

    if (node.key !== null && isBoundary(this, node)) {
      yield* this.deleteParents(0, key)
    }

    yield* this.store.deleteNode(0, key)

    const firstSibling = yield* getFirstSibling(this, node)
    if (firstSibling.key === null) {
      yield* this.updateAnchor(1)
    } else {
      yield* this.update(1, firstSibling.key)
    }

    return {}
  }

  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   */
  *update(level, key) {
    const oldNode = yield* this.getNode(level, key)
    const hash = yield* getHash(this, level, key)
    const newNode = /** @type {Okra.Node} */ ({ level, key, hash })
    yield* this.replace(oldNode, newNode)
  }

  /**
   *
   * @param {Okra.Node|null} oldNode
   * @param {Okra.Node} newNode
   * @returns {Task.Task<{}, Error>}
   */
  *replace(oldNode, newNode) {
    if (oldNode !== null && isBoundary(this, oldNode)) {
      yield* this.replaceBoundary(newNode)
    } else {
      const firstSibling = yield* getFirstSibling(this, newNode)
      yield* this.store.setNode(newNode)

      if (isBoundary(this, newNode)) {
        yield* this.createParents(newNode.level, newNode.key)
      }

      if (firstSibling.key == null) {
        yield* this.updateAnchor(newNode.level + 1)
      } else {
        yield* this.update(newNode.level + 1, firstSibling.key)
      }
    }
    return {}
  }

  /**
   *
   * @param {Okra.Node} node
   */
  *replaceBoundary(node) {
    yield* this.store.setNode(node)

    if (isBoundary(this, node)) {
      yield* this.update(node.level + 1, node.key)
    } else {
      yield* this.deleteParents(node.level, node.key)

      const firstSibling = yield* getFirstSibling(this, node)
      if (firstSibling.key === null) {
        yield* this.updateAnchor(node.level + 1)
      } else {
        yield* this.update(node.level + 1, firstSibling.key)
      }
    }
  }

  /**
   * @param {number} level
   * @returns {Task.Task<{}, Error>}
   */
  *updateAnchor(level) {
    const hash = yield* getHash(this, level, null)

    const anchor = { level, key: null, hash }
    yield* this.store.setNode(anchor)

    const nodes = this.store.nodes(level, { key: null, inclusive: false }, null)
    while (true) {
      const result = yield* nodes.next()
      if (result.error) {
        break
      } else {
        yield* this.updateAnchor(level + 1)
      }
    }

    yield* this.deleteParents(level, null)
    return {}
  }

  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   * @returns {Task.Task<{}, Error>}
   */
  *deleteParents(level, key) {
    const node = yield* this.getNode(level + 1, key)
    if (node !== null) {
      yield* this.store.deleteNode(level + 1, key)

      yield* this.deleteParents(level + 1, key)
    }
    return {}
  }

  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   * @returns {Task.Task<{}, Error>}
   */
  *createParents(level, key) {
    const hash = yield* getHash(this, level + 1, key)
    const node = /** @type {Okra.Node} */ ({ level: level + 1, key, hash })
    yield* this.store.setNode(node)

    if (isBoundary(this, node)) {
      yield* this.createParents(level + 1, key)
    }
    return {}
  }
}

/**
 * @param {object} self
 * @param {NodeStore} self.store
 * @param {Okra.Metadata} self.metadata
 * @param {number} self.limit
 * @param {number} level
 * @param {Okra.Key} key
 */
export function* getHash(self, level, key) {
  const hash = blake3.create({ dkLen: self.metadata.K })
  const nodes = self.store.nodes(level - 1, { key, inclusive: true })

  while (true) {
    const result = yield* nodes.next()
    if (result.error) {
      break
    }
    const node = result.ok
    if (compareKeys(key, node.key) === -1 && isBoundary(self, node)) {
      break
    }

    hash.update(node.hash)
  }

  const result = hash.digest()
  return result
}

/**
 * @param {object} self
 * @param {NodeStore} self.store
 * @param {number} self.limit
 * @param {Okra.Node} node
 * @returns {Task.Task<Okra.Node, Error>}
 */
export function* getFirstSibling(self, node) {
  if (node.key === null) {
    return node
  }

  const upperBound = { key: node.key, inclusive: true }
  const nodes = self.store.nodes(node.level, null, upperBound, {
    reverse: true,
  })

  while (true) {
    const result = yield* nodes.next()
    if (result.error) {
      break
    } else {
      const prev = result.ok
      if (prev.key === null || isBoundary(self, prev)) {
        return prev
      }
    }
  }

  throw new Error('Internal error')
}
