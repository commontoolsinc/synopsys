import * as Okra from '@canvas-js/okra'
export * from '@canvas-js/okra'
import { Constant, API, Task } from 'datalogia'
import * as CBOR from '@ipld/dag-cbor'
import { base58btc } from 'multiformats/bases/base58'
import * as Attribute from '../datum/attribute.js'
import * as Entity from '../datum/entity.js'
import * as Reference from '../datum/reference.js'
import * as Datum from '../datum.js'
import * as Fact from '../fact.js'
import * as Type from './type.js'

const { Bytes } = Constant
export { Task, CBOR }

const instances = new WeakMap()

/**
 * Represents an opaque database type with a methods corresponding to the
 * static functions exported by this module.
 *
 * @implements {API.Querier}
 * @implements {API.Transactor<Commit>}
 * @implements {Type.Database}
 */
export class Database {
  /**
   * @param {API.FactsSelector} [selector]
   */
  scan(selector) {
    return scan(this, selector)
  }

  /**
   * @param {API.Transaction} instructions
   */
  transact(instructions) {
    return transact(this, instructions)
  }

  status() {
    return status(this)
  }

  close() {
    return close(this)
  }
}

/**
 * Represents current revision of the database.
 */
class Revision {
  #root
  /**
   * @param {Okra.Node} root
   */
  constructor(root) {
    this.#root = root
  }
  /**
   * Hash of the merkle tree root of the database encoded as base58btc.
   */
  get id() {
    return base58btc.baseEncode(this.#root.hash)
  }

  toJSON() {
    return { id: this.id }
  }
}

/**
 * Resolves underlying Okra.Tree instance.
 *
 * @param {Database} database
 * @returns {Type.Store}
 */
const tree = (database) => instances.get(database)

/**
 *
 * @param {Type.Store} tree
 */
export function* open(tree) {
  const instance = new Database()
  instances.set(instance, tree)
  return instance
}

/**
 * Returns current revision of the database.
 *
 * @param {Database} db
 */
export const status = (db) =>
  tree(db).read(function* (reader) {
    const root = yield* reader.getRoot()
    return new Revision(root)
  })

/**
 * Closes the database instance. This is required to release filesystem lock
 * when using LMDB.
 *
 * @param {Database} db
 */
export function* close(db) {
  yield* tree(db).close()
  return {}
}

/**
 * Scans the database for all the datums that match a given selector, which
 * may include entity, attribute, and value or any combination of them. Will
 * return all the datums that match the selector.
 *
 * @param {Database} db
 * @param {API.FactsSelector} [selector]
 * @returns {API.Task<API.Datum[], Error>}
 */
export const scan = (db, { entity, attribute, value } = {}) =>
  tree(db).read((reader) => iterate(reader, { entity, attribute, value }))

/**
 * @param {Type.EntryRange} entries
 */
function* collectDatums(entries) {
  const results = []
  while (true) {
    const { done, value: entry } = yield* Task.wait(entries.next())
    if (done) {
      break
    } else {
      const [, value] = yield* Task.wait(entry)
      const datum = Datum.fromBytes(value)
      results.push(datum)
    }
  }

  return results
}

/**
 * @param {Type.EntryRange} entries
 * @param {SearchPath} path
 */
function* collectMatchingDatums(entries, [_index, _entity, _attribute, value]) {
  const results = []
  const suffix = /** @type {Uint8Array} */ (value)
  const offset = suffix.length + 1
  while (true) {
    const { done, value: entry } = yield* Task.wait(entries.next())
    if (done) {
      break
    } else {
      const [key, value] = yield* Task.wait(entry)
      if (Bytes.equal(key.subarray(-offset, -1), suffix)) {
        const datum = Datum.fromBytes(value)
        results.push(datum)
      }
    }
  }
  return results
}

/**
 * We may know entity and value but not the attribute. This is a rare case and
 * we do not have `EVAT` index to support it. In such case we  `EAVT` index
 * which retrieve all datums for and will have to then filter out the ones
 * that do not match the value.
 *
 * @param {API.FactsSelector} selector
 * @return {selector is [entity: API.Entity, attribute: undefined, value: API.Constant]}
 */
const isCoarseSearch = ({ entity, attribute, value }) =>
  entity != null && attribute === undefined && value != undefined

/**
 * Derives a search path from the given selector, by choosing an appropriate
 * index to scan in. When `entity` is provided `EAVT` index is used. When
 * `entity` is not provided but `attribute` is provided it will use `AEVT`
 * when `value` is not provided or `VAET` otherwise. When only `value` is
 * provided it will use `VAET` index.
 *
 * @typedef {[index:Uint8Array, group: Uint8Array | null, subgroup: Uint8Array | null, member: Uint8Array | null]} SearchPath
 * @param {API.FactsSelector} selector
 * @returns {SearchPath}
 */

export const deriveSearchPath = ({ entity, attribute, value }) => {
  // If we know an this looks like primary key lookup in traditional databases
  // in this case we use EAVT index.
  if (entity) {
    return [
      EAVT,
      Entity.toBytes(entity),
      attribute === undefined ? null : Attribute.toBytes(attribute),
      value === undefined ? null : Entity.toBytes(Reference.of(value)),
    ]
  }
  // If we do not know the entity but know a value we are most likely doing
  // a reverse lookup. In this case we use VAET index is used.
  else if (value !== undefined) {
    return [
      VAET,
      Entity.toBytes(Reference.of(value)),
      attribute === undefined ? null : Attribute.toBytes(attribute),
      null,
    ]
  }
  // If we know neither entity nor value we have column-style access pattern
  // and we use AEVT index.
  else if (attribute !== undefined) {
    return [AEVT, Attribute.toBytes(attribute), null, null]
  }
  // If we know nothing we simply choose an EAVT index.
  else {
    return [EAVT, null, null, null]
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
 * @param {[index:Uint8Array, group:Uint8Array|null, subgroup: Uint8Array|null, member: Uint8Array|null]} path
 */
export const toSearchKey = ([index, group, subgroup, member]) => {
  const size =
    index.length +
    1 +
    (group?.length ?? 0) +
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

  if (group) {
    key.set(group, offset)
    offset += group.length
    key.set([0], offset)
    offset += 1
  } else {
    return key.subarray(0, offset)
  }

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
 * @typedef {object} Change
 * @property {Uint8Array} origin
 * @property {number} time
 * @property {Type.Transaction} transaction
 *
 *
 * @param {Database} db
 * @param {Type.Transaction} changes
 * @returns {API.Task<Commit, Error>}
 */
export const transact = (db, changes) =>
  tree(db).write(function* (writer) {
    const root = yield* writer.getRoot()
    const hash = root.hash
    const time = Date.now()

    /** @type {Change} */
    const commit = {
      origin: hash,
      time,
      transaction: changes,
    }
    const cause = Reference.of(commit)

    yield* assert(writer, [cause, 'db/source', CBOR.encode(commit)], cause)
    for (const change of changes) {
      if (change.Retract) {
        yield* retract(writer, change.Retract, cause)
      }
      if (change.Upsert) {
        yield* upsert(writer, change.Upsert, cause)
      }
      if (change.Assert) {
        yield* assert(writer, change.Assert, cause)
      }

      if (change.Import) {
        for (const [entity, attribute, value] of Fact.iterate(change.Import)) {
          yield* assert(writer, [entity, attribute, value], cause)
        }
      }
    }

    return {
      before: new Revision(root),
      after: new Revision(yield* writer.getRoot()),
      cause: commit,
    }
  })

/**
 * Writes a fact into a database.
 *
 * @param {Type.Writer} writer
 * @param {API.Fact} fact
 * @param {Reference.Reference<Change>} cause
 */
export function* assert(writer, fact, cause) {
  const [entity, attribute, value] = fact
  const datum = Datum.toBytes([entity, attribute, value, cause])
  for (const key of keys(fact)) {
    yield* writer.set(key, datum)
  }
}

/**
 * @param {Type.Writer} writer
 * @param {API.Fact} fact
 * @param {Reference.Reference<Change>} cause
 */
export function* retract(writer, fact, cause) {
  for (const key of keys(fact)) {
    yield* writer.delete(key)
  }
}

/**
 * @param {Type.Writer} writer
 * @param {API.Fact} fact
 * @param {Reference.Reference<Change>} cause
 */
export function* upsert(writer, fact, cause) {
  const [entity, attribute, value] = fact
  const datums = yield* iterate(writer, { entity, attribute })
  for (const [entity, attribute, value] of datums) {
    yield* retract(writer, [entity, attribute, value], cause)
  }
  yield* assert(writer, fact, cause)
}

/**
 * @param {Type.Reader} reader
 * @param {API.FactsSelector} [selector]
 */
export const iterate = (reader, { entity, attribute, value } = {}) => {
  // Derives a search key path from the given selector. That will choose an
  // appropriate index.
  const path = deriveSearchPath({ entity, attribute, value })
  // Converts path into a key prefix to search by.
  const prefix = toSearchKey(path)
  const entries = reader.entries(toLowerBound(prefix), toUpperBound(prefix))

  // When we know entity and value but not the attribute we have an atypical
  // access pattern for which we do not have a dedicated index. In this case
  // we use `EAVT` index to retrieve all datums for the entity and then filter
  // out the ones that do not match the value.
  return isCoarseSearch({ entity, attribute, value })
    ? collectMatchingDatums(entries, path)
    : collectDatums(entries)
}

const DELETE = 0
const SET = 1
const REPLACE = 2

/**
 * @param {API.Fact} fact
 */
function* keys([entity, attribute, value]) {
  const e = Entity.toBytes(entity)
  const a = Attribute.toBytes(attribute)
  const v = Entity.toBytes(Reference.of(value))
  yield toSearchKey([EAVT, e, a, v])
  yield toSearchKey([AEVT, a, e, v])
  yield toSearchKey([VAET, v, a, e])
}

/**
 *
 * @typedef {object} Commit
 * @property {Revision} before
 * @property {Revision} after
 * @property {Change} cause
 */

const EAVT = new Uint8Array([0])
const AEVT = new Uint8Array([1])
const VAET = new Uint8Array([2])
