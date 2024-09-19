import * as LMDB from '@canvas-js/okra-lmdb'
import * as Memory from '@canvas-js/okra-memory'
import * as Okra from '@canvas-js/okra'
export * from '@canvas-js/okra'
import { Constant, API } from 'datalogia'
import * as UTF8 from './utf8.js'
import * as CBOR from '@ipld/dag-cbor'
import { fileURLToPath } from 'node:url'
import { base58btc } from 'multiformats/bases/base58'

const { Link } = Constant
export { Link, CBOR }

const instances = new WeakMap()

export class Database {
  /**
   * @param {Okra.Tree} tree
   */
  static load(tree) {
    const instance = new Database()
    instances.set(instance, tree)
    return instance
  }
}

class Revision {
  #root
  /**
   * @param {Okra.Node} root
   */
  constructor(root) {
    this.#root = root
  }
  get id() {
    return base58btc.baseEncode(this.#root.hash)
  }
}

/**
 *
 * @param {Database} database
 * @returns {Okra.Tree}
 */
const tree = (database) => instances.get(database)

/**
 * @typedef {import('@canvas-js/okra').Tree} Tree
 */
/**
 *
 * @param {URL} [url]
 * @param {import('@canvas-js/okra-lmdb').TreeOptions} [options]
 * @returns {Database}
 */
export const open = (url, options) => {
  if (!url || url.protocol === 'memory:') {
    return Database.load(new Memory.Tree(options))
  } else if (url?.protocol === 'file:') {
    return Database.load(new LMDB.Tree(fileURLToPath(url), options))
  } else {
    throw new Error(`Unsupported protocol: ${url.protocol}`)
  }
}

/**
 * @param {Database} db
 */
export const status = (db) =>
  tree(db).read((reader) => new Revision(reader.getRoot()))

/**
 * @param {Database} db
 */
export const close = (db) => tree(db).close()

/**
 * @typedef {readonly [entity: API.Entity, attribute: API.Attribute, value:API.Constant, cause: API.Entity]} Datum
 * @param {Database} db
 * @param {API.FactsSelector} selector
 * @returns {Promise<Datum[]>}
 */
export const scan = (db, { entity, attribute, value }) => {
  return tree(db).read((reader) => {
    const path = deriveSearchPath({ entity, attribute, value })
    const key = path ? toSearchKey(path) : null
    const entries = key
      ? reader.entries(toLowerBound(key), toUpperBound(key))
      : reader.entries()

    /** @type {Datum[]} */
    const results = []
    for (const [key, value] of entries) {
      const datum = CBOR.decode(value)
      results.push(datum)
    }
    return results
  })
}

/**
 * @param {API.FactsSelector} selector
 * @returns {[index:Uint8Array, group: Uint8Array, subgroup: Uint8Array | null, member: Uint8Array | null]|null}
 */

export const deriveSearchPath = ({ entity, attribute, value }) => {
  if (entity) {
    return [
      EAVT,
      Link.toBytes(entity),
      attribute === undefined ? null : CBOR.encode(attribute),
      value === undefined ? null : Link.toBytes(Link.of(value)),
    ]
  } else if (attribute != null) {
    return value !== undefined
      ? [VAET, Link.toBytes(Link.of(value)), CBOR.encode(attribute), null]
      : [AEVT, CBOR.encode(attribute), null, null]
  } else if (value !== undefined) {
    return [VAET, Link.toBytes(Link.of(value)), null, null]
  } else {
    return null
  }
}

/**
 * @param {Uint8Array} source
 * @returns
 */
export const toUpperBound = (source) => {
  const key = source.slice()
  key[key.length - 1] = 1

  return { key, inclusive: false }
}

/**
 *
 * @param {Uint8Array} key
 * @returns
 */
export const toLowerBound = (key) => {
  return { key, inclusive: true }
}
/**
 *
 * @param {[index:Uint8Array, group:Uint8Array, subgroup: Uint8Array|null, member: Uint8Array|null]} path
 */
export const toSearchKey = ([index, group, subgroup, member]) => {
  const size =
    index.length +
    1 +
    group.length +
    1 +
    (subgroup?.length ?? 0) +
    1 +
    (member?.length ?? 0) +
    1

  const key = new Uint8Array(size)
  let offset = 0

  key.set(index, offset)
  offset += index.length

  key.set([0], offset)
  offset += 1

  key.set(group, offset)
  offset += group.length
  key.set([0], offset)
  offset += 1

  if (subgroup) {
    key.set(subgroup, offset)
    offset += subgroup.length
    key.set([0], offset)
    offset += 1
  } else {
    return key.subarray(0, offset)
  }

  if (member) {
    key.set(member, offset)
    offset += member.length
    key.set([0], offset)
    offset += 1
  } else {
    return key.subarray(0, offset)
  }

  return key
}

/**
 * @typedef {API.Variant<{ Assert: API.Fact, Retract: API.Fact }>} Instruction
 *
 * @param {Database} db
 * @param {Instruction[]} instructions
 */
export const transact = (db, instructions) => {
  return tree(db).write((writer) => {
    const root = writer.getRoot()
    const hash = root.hash
    const time = Date.now()

    const cause = {
      origin: hash,
      time,
      transaction: instructions,
    }
    const tx = Link.of(cause)

    /** @type {{Assert: API.Fact}[]} */
    const assertions = [{ Assert: [tx, 'db/source', CBOR.encode(cause)] }]

    for (const instruction of [...assertions, ...instructions]) {
      if (instruction.Assert) {
        const [entity, attribute, value] = instruction.Assert
        const datum = [...instruction.Assert, tx]
        const fact = CBOR.encode(datum)
        const e = Link.toBytes(entity)
        const a = CBOR.encode(attribute)
        const v = Link.toBytes(Link.of(value))

        writer.set(toSearchKey([EAVT, e, a, v]), fact)
        writer.set(toSearchKey([AEVT, a, e, v]), fact)
        writer.set(toSearchKey([VAET, v, a, e]), fact)
      } else if (instruction.Retract) {
        const [entity, attribute, value] = instruction.Retract
        const e = Link.toBytes(entity)
        const a = CBOR.encode(attribute)
        const v = Link.toBytes(Link.of(value))

        const key = toSearchKey([EAVT, e, a, v])
        const entries = writer.entries(toLowerBound(key), toUpperBound(key))
        for (const [key] of entries) {
          writer.delete(key)
        }
        writer.delete(toSearchKey([EAVT, e, a, v]))
        writer.delete(toSearchKey([AEVT, a, e, v]))
        writer.delete(toSearchKey([VAET, v, a, e]))
      }
    }

    return {
      before: new Revision(root),
      after: new Revision(writer.getRoot()),
      cause,
    }
  })
}

const EAVT = UTF8.toUTF8('EAVT')
const AEVT = UTF8.toUTF8('AEVT')
const VAET = UTF8.toUTF8('VAET')
