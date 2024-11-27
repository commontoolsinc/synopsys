import * as Type from './replica/type.js'
import { transform } from './replica/sync.js'
import * as Reference from './datum/reference.js'
import * as Fact from './fact.js'
import * as CBOR from '@ipld/dag-cbor'
import { varint } from 'multiformats'

export const VERSION = 1
export const HEADER = new Uint8Array([VERSION])

/**
 * Encodes transaction log into a byte stream.
 *
 * @param {ReadableStream<Type.Transaction>} source
 * @returns {ReadableStream<Uint8Array>}
 */
export const encode = (source) =>
  transform(source, {
    *init() {
      return [null, []]
    },
    *step(_, transaction) {
      return [null, [encodeTransaction(transaction)]]
    },
    *close() {
      return []
    },
  })

/**
 * @param {ReadableStream<Uint8Array>} source
 * @returns {ReadableStream<Uint8Array>}
 */
export const partition = (source) =>
  transform(source, {
    *init() {
      return [new Uint8Array([]), []]
    },
    *step(body, chunk) {
      let buffer = append(body, chunk)

      /** @type {Uint8Array[]} */
      let frames = []

      while (buffer.length > 0) {
        let offset = 0
        let length = 0
        try {
          ;[length, offset] = varint.decode(buffer)
        } catch (error) {
          return [buffer, []]
        }

        // If we have enough bytes to decode we decode a transaction
        if (offset + length <= buffer.length) {
          frames.push(buffer.subarray(0, offset + length))
          buffer = buffer.subarray(offset + length)
        } else {
          // If we don't have enough bytes to decode we return the buffer
          break
        }
      }

      return [
        // Copy buffer if we consumed some bytes to release memory used
        // by the buffer
        buffer.byteOffset > 0 ? buffer.slice(0) : buffer,
        frames,
      ]
    },
    *close() {
      return []
    },
  })
/**
 * @param {ReadableStream<Uint8Array>} source
 * @returns {ReadableStream<Type.Transaction>}
 */
export const decode = (source) =>
  transform(partition(source), {
    *init() {
      return [null, []]
    },
    *step(_, chunk) {
      return [_, [decodeTransaction(chunk)]]
    },
    *close() {
      return []
    },
  })

/**
 * @param {Type.Transaction} transaction
 */
export function encodeTransaction(transaction) {
  /** @type {Patch} */
  const patch = {}
  for (const change of transaction) {
    if (change.Assert) {
      assert(change.Assert, patch)
    }
    if (change.Retract) {
      retract(change.Retract, patch)
    }
    if (change.Upsert) {
      upsert(change.Upsert, patch)
    }
    if (change.Import) {
      for (const fact of Fact.iterate(change.Import)) {
        assert(fact, patch)
      }
    }
  }

  const body = CBOR.encode(patch)
  const header = varint.encodeTo(
    body.byteLength,
    new Uint8Array(varint.encodingLength(body.byteLength))
  )

  return append(header, body)
}

/**
 * @param {Uint8Array} bytes
 * @returns {Type.Transaction}
 */
export function decodeTransaction(bytes) {
  const [length, offset] = varint.decode(bytes)
  const patch = CBOR.decode(bytes.subarray(offset, offset + length))
  /** @type {Type.Instruction[]} */
  const transaction = []
  for (const [entity, attributes] of Object.entries(patch)) {
    for (const [attribute, values] of Object.entries(attributes)) {
      if (values['+']) {
        transaction.push({
          Assert: [
            Reference.fromString(entity),
            attribute,
            Reference.from(values['+']),
          ],
        })
      }
      if (values['-']) {
        transaction.push({
          Retract: [
            Reference.fromString(entity),
            attribute,
            Reference.from(values['-']),
          ],
        })
      }
      if (values['=']) {
        transaction.push({
          Upsert: [
            Reference.fromString(entity),
            attribute,
            Reference.from(values['=']),
          ],
        })
      }
    }
  }
  return transaction
}

/**
 * @typedef {{'+'?: Type.Scalar, '-'?: Type.Scalar, '='?: Type.Scalar}} Delta
 * @typedef {Record<string, Record<string, Delta>>} Patch
 */

/**
 * @param {Type.Fact} change
 * @param {Patch} patch
 */
function assert([entity, attribute, value], patch) {
  const attributes = patch[`${entity}`] ?? (patch[`${entity}`] = {})
  const values = attributes[`${attribute}`] ?? (attributes[`${attribute}`] = {})
  values[`+`] = value
}

/**
 * @param {Type.Fact} change
 * @param {Patch} patch
 */
function retract([entity, attribute, value], patch) {
  const attributes = patch[`${entity}`] ?? (patch[`${entity}`] = {})
  const values = attributes[`${attribute}`] ?? (attributes[`${attribute}`] = {})
  values[`-`] = value
}
/**
 * @param {Type.Fact} change
 * @param {Patch} patch
 */
function upsert([entity, attribute, value], patch) {
  const attributes = patch[`${entity}`] ?? (patch[`${entity}`] = {})
  const values = attributes[`${attribute}`] ?? (attributes[`${attribute}`] = {})
  values[`=`] = value
}

/**
 * @param {Uint8Array} buffer
 * @param {Uint8Array} chunk
 */
const append = (buffer, chunk) => {
  if (buffer.byteLength === 0) {
    return chunk
  }

  if (chunk.byteLength === 0) {
    return buffer
  }

  const content = new Uint8Array(buffer.length + chunk.length)
  content.set(buffer, 0)
  content.set(chunk, buffer.byteLength)

  return content
}
