import * as Type from '../replica/type.js'
import { refer, is as isReference } from '../datum/reference.js'
// @ts-expect-error - Got no typedefs
import { decodeInt32, encodeInt32 } from 'leb'
import { Constant } from 'datalogia'
import * as UTF8 from '../utf8.js'

const { Bytes } = Constant

/**
 * @template {{}|null} T
 * @typedef {object} Reader
 * @property {(head: Type.Reference<T>) => T|null} read
 */

/**
 * @template {{}|null} T
 * @typedef {object} Writer
 * @property {(head: T) => Type.Reference<T>} write
 */

/**
 * @template T
 * @typedef {object} Causal
 * @property {T} head
 * @property {Type.Reference<Causal<T>>[]} cause
 */

/**
 * @template T
 * @typedef {Causal<T>[]} CausalSet
 */

/**
 * @template T
 * @param {T} head
 */
export const create = (head) =>
  new Builder(new ReferenceStore(), [{ head, cause: [] }])

/**
 * @template T
 * @param {Type.Reference<Causal<T>>[]} cause
 * @param {T} head
 */
export const assert = (cause, head) => [{ head, cause }]

/**
 * @template T
 * @param {CausalSet<T>} local
 * @param {CausalSet<T>} remote
 * @param {Reader<Causal<T>>} store
 * @returns {CausalSet<T>}
 */
export const merge = (local, remote, store) => {
  const merged = []
  for (const head of remote) {
    if (compare(local, head, store) <= 0) {
      merged.push(head)
    }
  }

  for (const head of local) {
    if (compare(remote, head, store) < 0) {
      merged.push(head)
    }
  }

  return merged.sort((left, right) =>
    refer(left).toString().localeCompare(refer(right).toString())
  )
}

/**
 * @template T
 * @param {Causal<T>} head
 * @param {CausalSet<T>} cause
 * @param {Reader<Causal<T>>} store
 */
export const compare = (cause, head, store) => {
  const dependencies = new Set(head.cause.map((cause) => cause.toString()))
  for (const [depth, member] of iterate(cause, store)) {
    if (equal(member, refer(head))) {
      return depth
    } else if (dependencies.has(member.toString())) {
      dependencies.delete(member.toString())
    }

    // If we found all causal dependencies we will not longer find a head.
    if (dependencies.size === 0) {
      break
    }
  }

  return -1
}

/**
 * Checks if two revisions are equal.
 *
 * @param {Type.Reference} actual
 * @param {Type.Reference} other
 */
const equal = (actual, other) => Bytes.equal(actual['/'], other['/'])

/**
 * Iterates the set in the breadth-first order.
 *
 * @template T
 * @param {CausalSet<T>} cause
 * @param {Reader<Causal<T>>} store
 * @returns {Iterable<[number, Type.Reference<Causal<T>>]>}
 */
export function* iterate(cause, store) {
  let depth = 0
  const seen = new Set()
  const heads = [...cause.map((cause) => refer(cause))]
  while (heads.length > 0) {
    let size = heads.length
    let offset = 0
    while (offset < size) {
      const top = heads[offset]
      if (!seen.has(top.toString())) {
        yield [depth, top]
        seen.add(top.toString())

        const head = store.read(top)
        if (head) {
          for (const cause of head.cause) {
            heads.push(cause)
          }
        }
      }

      offset += 1
    }
    heads.splice(0, size)
    depth++
  }
}

/**
 * @template T
 */
class Builder {
  /**
   * @param {Writer<Causal<T>>} writer
   * @param {CausalSet<T>} model
   */
  constructor(writer = new ReferenceStore(), model = []) {
    this.writer = writer
    this.model = model
  }
  /**
   *
   * @param {T} head
   */
  assert(head) {
    this.model = assert(this.model.map(refer), head)
    this.writer.write(this.model[0])
    return this
  }

  build() {
    return this.model
  }
}

/**
 * @template T
 */
class ReferenceStore {
  constructor() {
    this.data = new Map()
  }
  /**
   *
   * @param {Causal<T>} causal
   * @returns {Type.Reference<Causal<T>>}
   */
  write(causal) {
    const reference = refer(causal)
    this.data.set(reference.toString(), causal)
    return reference
  }
  /**
   *
   * @param {Type.Reference<Causal<T>>} reference
   */
  read(reference) {
    const causal = this.data.get(reference.toString())
    return causal ?? null
  }
}

export const store = () => new ReferenceStore()

/**
 * @template T
 * @param {ReferenceStore<T>} store
 */
export const builder = (store) => new Builder(store)

/**
 * @template {Type.Constant} T
 */
class Encoder {
  /**
   * @param {ArrayBuffer} buffer
   */
  constructor(buffer) {
    this.bytes = new Uint8Array(buffer)
    this.offset = 0
  }
  /**
   * @param {T} head
   */
  assert(head) {
    switch (typeof head) {
      case 'string': {
        return this.write(UTF8.toUTF8(head))
      }
      case 'number':
      case 'bigint': {
        return this.write(LEB128.encode(head))
      }
      case 'boolean': {
        return this.write(new Uint8Array([head ? 1 : 0]))
      }
      default:
        if (head === null) {
          return this.write(new Uint8Array([0]))
        } else if (head instanceof Uint8Array) {
          return this.write(head)
        } else {
          return this.write(Reference.digest(head))
        }
    }
  }
  /**
   *
   * @param {Uint8Array} bytes
   */
  write(bytes) {}
}

/**
 *
 * @param {Uint8Array} bytes
 * @returns
 */
const fromBytes = (bytes) => {
  let offset = 0
  const [count, countSize] = readInt32(bytes, offset)
  offset += countSize

  const cause = []
  while (cause.length < count) {
    const [casual, casualSize] = readCausal(bytes, offset)
    cause.push(casual)
    offset += casualSize
  }
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {[Causal<unknown>, number]}
 */
const readCausal = (bytes, offset) => {
  let start = offset
  const [size, sizeLength] = readInt32(bytes, offset)
  offset += sizeLength
  const head = bytes.subarray(offset, offset + size)
  offset += size
  const [count, countLength] = readInt32(bytes, offset)
  offset += countLength
  const cause = []
  while (cause.length < count) {
    const [member, memberLength] = readCause(bytes, offset)
    offset += memberLength
    cause.push(member)
  }

  return [{ head, cause }, offset - start]
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {[Uint8Array, number]}
 */
const readCause = (bytes, offset) => {
  const [size, sizeLength] = readInt32(bytes, offset)
  const slice = bytes.subarray(offset + sizeLength, size)
  return [slice, sizeLength + slice.length]
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {[int:number, offset:number]}
 */
const readInt32 = (bytes, offset) => {
  // @ts-expect-error - LEB module does not have typedefs
  const { value, nextIndex } = LEB.decodeInt32(bytes, offset)
  return [value, nextIndex - offset]
}
