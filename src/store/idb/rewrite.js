import * as Okra from '@canvas-js/okra'
import { sha256 } from '@noble/hashes/sha256'
import { NodeStore } from './store.js'
/**
 * NodeStore is an internal class that Tree and Builder both extend.
 * Its only purpose is to encapsulate the node-to-entry and
 * entry-to-node conversion methods.
 */
export class NodeStore {
  store
  metadata
  static metadataKey = new Uint8Array([0xff])
  static anchorLeafKey = new Uint8Array([0])
  limit

  /**
   *
   * @param {Okra.KeyValueStore} store
   * @param {Okra.Metadata} metadata
   */
  constructor(store, metadata) {
    this.store = store
    this.metadata = metadata
    this.limit = Number((1n << 32n) / BigInt(metadata.Q))
  }
  async initialize() {
    const metadata = await this.getMetadata()
    if (metadata === null) {
      await this.setMetadata(this.metadata)
      await this.setNode({
        level: 0,
        key: null,
        hash: this.getLeafAnchorHash(),
      })
    } else if (metadata.K !== this.metadata.K) {
      throw new Error('metadata.K conflict')
    } else if (metadata.Q !== this.metadata.Q) {
      throw new Error('metadata.Q conflict')
    }
  }
  /**
   *
   * @param {Okra.Metadata} metadata
   */
  async setMetadata(metadata) {
    const valueBuffer = new ArrayBuffer(10)
    const valueView = new DataView(valueBuffer, 0, 10)
    const value = new Uint8Array(valueBuffer, 0, 10)
    new TextEncoder().encodeInto('okra', value)
    value[4] = OKRA_VERSION
    value[5] = metadata.K
    valueView.setUint32(6, metadata.Q)
    await this.store.set(NodeStore.metadataKey, value)
  }
  async getMetadata() {
    const value = await this.store.get(NodeStore.metadataKey)
    if (value === null) {
      return null
    } else if (value.length === 10) {
      const view = new DataView(
        value.buffer,
        value.byteOffset,
        value.byteLength
      )
      return { K: value[5], Q: view.getUint32(6) }
    } else {
      throw new Error('Invalid metadata entry')
    }
  }
  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   * @returns
   */
  async getNode(level, key) {
    const entryKey = NodeStore.createEntryKey(level, key)
    const entryValue = await this.store.get(entryKey)
    return entryValue && this.parseEntry([entryKey, entryValue])
  }
  /**
   *
   * @param {Okra.Node} node
   */
  async setNode(node) {
    if (node.hash.byteLength !== this.metadata.K) {
      throw new Error('Internal error: node hash is not K bytes')
    }
    const entryKey = NodeStore.createEntryKey(node.level, node.key)
    if (node.level === 0 && node.key !== null) {
      if (node.value === undefined) {
        throw new Error('Internal error: expected leaf node to have a value')
      }
      const entryValue = new Uint8Array(
        new ArrayBuffer(this.metadata.K + node.value.byteLength)
      )
      entryValue.set(node.hash)
      entryValue.set(node.value, this.metadata.K)
      await this.store.set(entryKey, entryValue)
    } else {
      await this.store.set(entryKey, node.hash)
    }
  }
  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   */
  async deleteNode(level, key) {
    const entryKey = NodeStore.createEntryKey(level, key)
    await this.store.delete(entryKey)
  }
  /**
   *
   * @param {number} level
   * @param {Okra.Bound<Okra.Key>|null} [lowerBound]
   * @param {Okra.Bound<Okra.Key>|null} [upperBound]
   * @param {{reverse?:boolean}} [options]
   * @returns {AsyncIterable<Okra.Node>}
   */
  async *nodes(
    level,
    lowerBound = null,
    upperBound = null,
    { reverse = false } = {}
  ) {
    const lowerKeyBound = lowerBound
      ? {
          key: NodeStore.createEntryKey(level, lowerBound.key),
          inclusive: lowerBound.inclusive,
        }
      : { key: NodeStore.createEntryKey(level, null), inclusive: true }
    const upperKeyBound = upperBound
      ? {
          key: NodeStore.createEntryKey(level, upperBound.key),
          inclusive: upperBound.inclusive,
        }
      : { key: NodeStore.createEntryKey(level + 1, null), inclusive: false }
    for await (const entry of this.store.entries(lowerKeyBound, upperKeyBound, {
      reverse,
    })) {
      yield this.parseEntry(entry)
    }
  }
  /**
   *
   * @param {Okra.Entry} entry
   * @returns {Okra.Node}
   */
  parseEntry([entryKey, entryValue]) {
    const [level, key] = NodeStore.parseEntryKey(entryKey)
    if (entryValue.byteLength < this.metadata.K) {
      throw new Error('Internal error: entry value is less than K bytes')
    }
    const hash = entryValue.subarray(0, this.metadata.K)
    if (level === 0 && key !== null) {
      return { level, key, hash, value: entryValue.subarray(this.metadata.K) }
    } else {
      return { level, key, hash }
    }
  }
  /**
   *
   * @param {Uint8Array} entryKey
   * @returns {[level: number, key: Okra.Key]}
   */
  static parseEntryKey(entryKey) {
    if (entryKey.byteLength === 0) {
      throw new Error('Internal error: empty entry key')
    } else if (entryKey.byteLength === 1) {
      return [entryKey[0], null]
    } else {
      return [entryKey[0], entryKey.subarray(1)]
    }
  }
  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   * @returns {Uint8Array}
   */
  static createEntryKey(level, key) {
    if (key === null) {
      return new Uint8Array([level])
    } else {
      const entryKey = new Uint8Array(new ArrayBuffer(1 + key.length))
      entryKey[0] = level
      entryKey.set(key, 1)
      return entryKey
    }
  }
  static size = new ArrayBuffer(4)
  static view = new DataView(NodeStore.size)

  /**
   *
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   * @returns {Uint8Array}
   */
  hashEntry(key, value) {
    const hash = sha256.create()
    NodeStore.view.setUint32(0, key.length)
    hash.update(new Uint8Array(NodeStore.size))
    hash.update(key)
    NodeStore.view.setUint32(0, value.length)
    hash.update(new Uint8Array(NodeStore.size))
    hash.update(value)
    return hash.digest().subarray(0, this.metadata.K)
  }
  /**
   *
   * @param {Okra.Node} node
   * @returns {boolean}
   */
  isBoundary(node) {
    const view = new DataView(node.hash.buffer, node.hash.byteOffset, 4)
    return view.getUint32(0) < this.limit
  }
  /**
   * @returns {Uint8Array}
   */
  getLeafAnchorHash = () =>
    sha256(new Uint8Array([])).subarray(0, this.metadata.K)
}

export class Builder extends NodeStore {
  /**
   * @param {*} store
   * @param {Okra.Metadata} metadata
   * @returns
   */
  static async open(store, metadata = DEFAULT_METADATA) {
    const builder = new Builder(store, metadata)
    await builder.initialize()
    await builder.setNode({
      level: 0,
      key: null,
      hash: builder.getLeafAnchorHash(),
    })
    return builder
  }
  nodeCount = 1
  /**
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   */
  async set(key, value) {
    const hash = this.hashEntry(key, value)
    await this.setNode({ level: 0, key, hash, value })
    this.nodeCount += 1
  }
  async finalize() {
    let level = 0
    while (this.nodeCount > 1) {
      this.nodeCount = await this.buildLevel(level++)
    }
    const root = await this.getNode(level, null)
    assert(root !== null, 'root not found')
    return root
  }
  /**
   * @param {number} level
   */
  async buildLevel(level) {
    const iter = this.nodes(level)
    const next = () =>
      iter.next().then(({ done, value }) => (done ? null : value))
    try {
      let nodeCount = 0
      let node = await next()
      assert(node !== null, 'level is empty')
      assert(
        node.level === level && node.key === null,
        'first node was not an anchor'
      )
      let key = node.key
      let hash = sha256.create()
      hash.update(node.hash)
      while (true) {
        node = await next()
        if (node === null) {
          const result = hash.digest().subarray(0, this.metadata.K)
          await this.setNode({ level: level + 1, key, hash: result })
          nodeCount++
          break
        }
        assert(node.level === level, 'unexpected node level')
        if (this.isBoundary(node)) {
          const result = hash.digest().subarray(0, this.metadata.K)
          await this.setNode({ level: level + 1, key, hash: result })
          nodeCount++
          key = node.key
          hash = sha256.create()
          hash.update(node.hash)
        } else {
          hash.update(node.hash)
        }
      }
      return nodeCount
    } finally {
      if (iter.return !== undefined) {
        const { done, value } = await iter.return()
        assert(done && value === undefined) // ???
      }
    }
  }
}

export class Tree extends NodeStore {
  store
  static leafEntryLowerBound = {
    key: NodeStore.createEntryKey(0, null),
    inclusive: false,
  }
  static leafEntryUpperBound = {
    key: NodeStore.createEntryKey(1, null),
    inclusive: false,
  }
  log = debug('okra:tree')
  /**
   *
   * @param {*} store
   * @param {Partial<Okra.Metadata>} [options]
   */
  constructor(store, options = {}) {
    const metadata = { K: options.K ?? DEFAULT_K, Q: options.Q ?? DEFAULT_Q }
    super(store, metadata)
    this.store = store
  }
  /**
   * @param {Okra.Bound<Uint8Array>|null} [lowerBound]
   * @param {Okra.Bound<Uint8Array>|null} [upperBound]
   * @param {{reverse?:boolean}} [options]
   * @returns {AsyncIterable<Okra.Entry>}
   */
  async *entries(
    lowerBound = null,
    upperBound = null,
    { reverse = false } = {}
  ) {
    const lowerKeyBound = lowerBound
      ? {
          key: NodeStore.createEntryKey(0, lowerBound.key),
          inclusive: lowerBound.inclusive,
        }
      : Tree.leafEntryLowerBound
    const upperKeyBound = upperBound
      ? {
          key: NodeStore.createEntryKey(0, upperBound.key),
          inclusive: upperBound.inclusive,
        }
      : Tree.leafEntryUpperBound
    for await (const entry of this.store.entries(lowerKeyBound, upperKeyBound, {
      reverse,
    })) {
      const node = this.parseEntry(entry)
      if (node.key === null || node.value === undefined) {
        throw new Error('Internal error - unexpected leaf entry')
      }
      yield [node.key, node.value]
    }
  }
  /**
   * @param {Uint8Array} key
   * @returns {Promise<Uint8Array|null>}
   */
  async get(key) {
    const node = await this.getNode(0, key)
    if (node === null) {
      return null
    } else if (node.value !== undefined) {
      return node.value
    } else {
      throw new Error('Internal error - missing leaf value')
    }
  }
  /**
   *
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   */
  async set(key, value) {
    this.log(`set(%h, %h)`, key, value)
    const oldLeaf = await this.getNode(0, key)
    const hash = this.hashEntry(key, value)
    const newLeaf = { level: 0, key, hash, value }
    await this.replace(oldLeaf, newLeaf)
  }
  /**
   * @param {Uint8Array} key
   */
  async delete(key) {
    this.log(`delete(%h)`, key)
    const node = await this.getNode(0, key)
    if (node === null) {
      return
    }
    if (node.key !== null && this.isBoundary(node)) {
      await this.deleteParents(0, key)
    }
    await this.deleteNode(0, key)
    const firstSibling = await this.getFirstSibling(node)
    if (firstSibling.key === null) {
      await this.updateAnchor(1)
    } else {
      await this.update(1, firstSibling.key)
    }
  }
  /**
   * @param {number} level
   * @param {Okra.Key} key
   */
  async update(level, key) {
    const oldNode = await this.getNode(level, key)
    const hash = await this.getHash(level, key)
    const newNode = { level, key, hash }
    await this.replace(oldNode, newNode)
  }
  /**
   * @param {Okra.Node} oldNode
   * @param {Okra.Node} newNode
   */
  async replace(oldNode, newNode) {
    if (oldNode !== null && this.isBoundary(oldNode)) {
      await this.replaceBoundary(newNode)
    } else {
      const firstSibling = await this.getFirstSibling(newNode)
      await this.setNode(newNode)
      if (this.isBoundary(newNode)) {
        await this.createParents(newNode.level, newNode.key)
      }
      if (firstSibling.key == null) {
        await this.updateAnchor(newNode.level + 1)
      } else {
        await this.update(newNode.level + 1, firstSibling.key)
      }
    }
  }
  /**
   * @param {Okra.Node} node
   */
  async replaceBoundary(node) {
    if (this.isBoundary(node)) {
      await this.setNode(node)
      await this.update(node.level + 1, node.key)
    } else {
      await this.setNode(node)
      await this.deleteParents(node.level, node.key)
      const firstSibling = await this.getFirstSibling(node)
      if (firstSibling.key === null) {
        await this.updateAnchor(node.level + 1)
      } else {
        await this.update(node.level + 1, firstSibling.key)
      }
    }
  }
  /**
   * @param {number} level
   */
  async updateAnchor(level) {
    const hash = await this.getHash(level, null)
    await this.setNode({ level, key: null, hash })
    for await (const node of this.nodes(
      level,
      { key: null, inclusive: false },
      null
    )) {
      await this.updateAnchor(level + 1)
      return
    }
    await this.deleteParents(level, null)
  }
  /**
   * @param {number} level
   * @param {Okra.Key} key
   */
  async deleteParents(level, key) {
    const node = await this.getNode(level + 1, key)
    if (node !== null) {
      await this.deleteNode(level + 1, key)
      await this.deleteParents(level + 1, key)
    }
  }
  /**
   * @param {number} level
   * @param {Okra.Key} key
   */
  async createParents(level, key) {
    const hash = await this.getHash(level + 1, key)
    const node = { level: level + 1, key, hash }
    await this.setNode(node)
    if (this.isBoundary(node)) {
      await this.createParents(level + 1, key)
    }
  }
  /**
   * @param {Okra.Node} node
   */
  async getFirstSibling(node) {
    if (node.key === null) {
      return node
    }
    const upperBound = { key: node.key, inclusive: true }
    for await (const prev of this.nodes(node.level, null, upperBound, {
      reverse: true,
    })) {
      if (prev.key === null || this.isBoundary(prev)) {
        return prev
      }
    }
    throw new Error('Internal error')
  }
  /**
   * @param {Okra.Node} node
   */
  async getParent(node) {
    const { level, key } = await this.getFirstSibling(node)
    return await this.getNode(level + 1, key)
  }
  /**
   * @param {number} level
   * @param {Okra.Key} key
   * @returns
   */
  async getHash(level, key) {
    this.log('hashing %d %k', level, key)
    const hash = sha256.create()
    for await (const node of this.nodes(level - 1, { key, inclusive: true })) {
      if (lessThan(key, node.key) && this.isBoundary(node)) {
        break
      }
      this.log('------- %h (%k)', node.hash, node.key)
      hash.update(node.hash)
    }
    return hash.digest().subarray(0, this.metadata.K)
  }
  /**
   * Get the root node of the merkle tree. Returns the leaf anchor node if the tree is empty.
   */
  async getRoot() {
    const upperBound = {
      key: new Uint8Array([MAXIMUM_HEIGHT]),
      inclusive: false,
    }
    for await (const entry of this.store.entries(null, upperBound, {
      reverse: true,
    })) {
      const node = this.parseEntry(entry)
      assert(
        node.key === null,
        'Internal error: unexpected root node key',
        node
      )
      return node
    }
    throw new Error('Internal error: empty node store')
  }
  /**
   * Get the children of a node in the merkle tree, identified by level and key.
   * @param {number} level
   * @param {Okra.Key} key
   */
  async getChildren(level, key) {
    if (level === 0) {
      throw new RangeError('Cannot get children of a leaf node')
    }
    const children = []
    for await (const node of this.nodes(level - 1, { key, inclusive: true })) {
      if (this.isBoundary(node) && !equalKeys(node.key, key)) {
        break
      } else {
        children.push(node)
      }
    }
    return children
  }
  /**
   * Raze and rebuild the merkle tree from the leaves.
   * @returns the new root node
   */
  async rebuild() {
    const lowerBound = {
      key: NodeStore.createEntryKey(1, null),
      inclusive: true,
    }
    for await (const [entryKey] of this.store.entries(lowerBound)) {
      await this.store.delete(entryKey)
    }
    const builder = await Builder.open(this.store, this.metadata)
    const root = await builder.finalize()
    return root
  }
  /**
   * Pretty-print the tree structure to a utf-8 stream.
   * Consume with a TextDecoderStream or async iterable sink.
   *
   * @param {{hashSize?:number}} [options]
   */
  async *print(options = {}) {
    const hashSize = options.hashSize ?? 4
    const slot = '  '.repeat(hashSize)
    /**
     * @param {{hash: Uint8Array}} input
     */
    const hash = ({ hash }) => hex(hash.subarray(0, hashSize))
    const encoder = new TextEncoder()
    const tree = this
    /**
     *
     * @param {string} prefix
     * @param {string} bullet
     * @param {Okra.Node} node
     * @returns {AsyncIterable<Uint8Array>}
     */
    async function* printTree(prefix, bullet, node) {
      yield encoder.encode(bullet)
      yield encoder.encode(` ${hash(node)} `)
      if (node.level === 0) {
        if (node.key === null) {
          yield encoder.encode(`│\n`)
        } else {
          yield encoder.encode(`│ ${hex(node.key)}\n`)
        }
      } else {
        const children = await tree.getChildren(node.level, node.key)
        for (const [i, child] of children.entries()) {
          if (i > 0) {
            yield encoder.encode(prefix)
          }
          if (i < children.length - 1) {
            yield* printTree(
              prefix + '│   ' + slot,
              i === 0 ? '┬─' : '├─',
              child
            )
          } else {
            yield* printTree(
              prefix + '    ' + slot,
              i === 0 ? '──' : '└─',
              child
            )
          }
        }
      }
    }
    const root = await this.getRoot()
    yield* printTree('    ' + slot, '──', root)
  }
}

export class IDBTree extends Tree {
  store
  /**
   *
   * @param {*} db
   * @param {string} storeName
   * @param {Partial<Okra.Metadata>} [options]
   * @returns
   */
  static async open(db, storeName, options = {}) {
    const store = new NodeStore(db, storeName)
    const tree = new IDBTree(store, options)
    await store.write(() => tree.initialize())
    return tree
  }
  /**
   * @param {NodeStore} store
   * @param {Partial<Okra.Metadata>} options
   */
  constructor(store, options) {
    super(store, options)
    this.store = store
  }
  /**
   * @param {Uint8Array} key
   * @returns {Promise<Uint8Array|null>}
   */
  async get(key) {
    return this.store.read(() => super.get(key))
  }
  /**
   * @param {Uint8Array} key
   * @param {Uint8Array} value
   */
  async set(key, value) {
    if (this.store.txn === null) {
      await this.store.write(() => super.set(key, value))
    } else {
      await super.set(key, value)
    }
  }
  /**
   * @param {Uint8Array} key
   */
  async delete(key) {
    if (this.store.txn === null) {
      await this.store.write(() => super.delete(key))
    } else {
      await super.delete(key)
    }
  }
  /**
   * @returns {Promise<Okra.Node>}
   */
  async getRoot() {
    if (this.store.txn === null) {
      return this.store.read(() => super.getRoot())
    } else {
      return super.getRoot()
    }
  }
  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   * @returns {Promise<Okra.Node|null>}
   */
  getNode(level, key) {
    if (this.store.txn === null) {
      return this.store.read(() => super.getNode(level, key))
    } else {
      return super.getNode(level, key)
    }
  }
  /**
   *
   * @param {number} level
   * @param {Okra.Key} key
   * @returns {Promise<Okra.Node[]>}
   */
  getChildren(level, key) {
    if (this.store.txn === null) {
      return this.store.read(() => super.getChildren(level, key))
    } else {
      return super.getChildren(level, key)
    }
  }
  /**
   *
   * @param {number} level
   * @param {Okra.Bound<Okra.Key>|null} [lowerBound]
   * @param {Okra.Bound<Okra.Key>|null} [upperBound]
   * @param {{reverse?:boolean}} [options]
   * @returns {AsyncIterable<Okra.Node>}
   */
  async *nodes(
    level,
    lowerBound = null,
    upperBound = null,
    { reverse = false } = {}
  ) {
    if (this.store.txn === null) {
      // TODO: fix this
      throw new Error('can only call nodes() from within a managed transaction')
    } else {
      yield* super.nodes(level, lowerBound, upperBound, { reverse })
    }
  }
  /**
   *
   * @param {Okra.Bound<Uint8Array>|null} lowerBound
   * @param {Okra.Bound<Uint8Array>|null} upperBound
   * @param {{reverse?:boolean}} options
   * @returns {AsyncIterable<Okra.Entry>}
   */
  async *entries(
    lowerBound = null,
    upperBound = null,
    { reverse = false } = {}
  ) {
    if (this.store.txn === null) {
      // TODO: fix this
      throw new Error(
        'can only call entries() from within a managed transaction'
      )
    } else {
      for await (const leaf of this.nodes(
        0,
        lowerBound ?? { key: null, inclusive: false },
        upperBound,
        { reverse }
      )) {
        assert(
          leaf.key !== null && leaf.value !== undefined,
          'invalid leaf entry'
        )
        yield [
          /** @type {Uint8Array} */ (leaf.key),
          /** @type {Uint8Array} */ (leaf.value),
        ]
      }
    }
  }
}
