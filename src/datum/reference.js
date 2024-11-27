import { Reference, refer, base32 } from 'merkle-reference'
import { Link, API } from 'datalogia'

export const { is } = Reference

/**
 * Multiformat code for the merkle reference.
 * @see https://github.com/multiformats/multicodec/pull/357
 */
export const CODE = /** @type {0x07} */ (refer(null).code)

/**
 * @see https://github.com/multiformats/multicodec/blob/master/table.csv#L9
 */
export const SHA256_CODE = /** @type {0x12} */ (0x12)

/**
 * Sha256 multihash digest size is 32 bytes.
 * @see https://github.com/multiformats/rust-multihash/blob/4c0ef5268355308d7f083482dad1c81318db4f6b/codetable/src/hasher_impl.rs#L207
 */
export const DIGEST_SIZE = 32

/**
 * Binary representation of the merkle reference is as follows
 *
 * ```ts
 * [MerkleReference: 0x07,
 *  SHA256: 0x12,
 *  Size: 32,
 *  ...(Uint8Array & {length: 32})
 * ]
 * ```
 *
 * So first 3 bytes represent a header and next 32 bytes
 * represent the body.
 */
export const SIZE = 3 + DIGEST_SIZE

/**
 * @template {{}|null} T
 * @typedef {API.Phantom<T> & {
 *  toJSON(): { '/': string }
 *  toString(): string
 *  readonly ['/']: Uint8Array
 * }} Reference
 */

/**
 * @template {{}|null} T
 * @param {T} value
 * @returns {Reference<T>|T}
 */
export const from = (value) => {
  if (Link.is(value) && value['/'][1] === CODE) {
    return /** @type {Reference<T>} */ (
      Reference.fromDigest(value['/'].subarray(4))
    )
  } else {
    return value
  }
}

/**
 * Takes string produced by `refer({}).toString()` and creates equal reference.
 * If string is not a valid reference serialization it will return `implicit`
 * that was provided. If implicit is not provided an error will be thrown
 * instead.
 *
 * @template T
 * @template {{}|null} [Implicit=never]
 * @param {string} source
 * @param {Implicit} [implicit]
 * @returns {Reference<T>|Implicit}
 */
export const fromString = (source, implicit) => {
  try {
    const bytes = base32.decode(source)
    const reference = fromBytes(bytes)
    if (bytes.length !== SIZE) {
      throw new ReferenceError(`Invalid reference ${source}`)
    } else {
      return reference
    }
  } catch (error) {
    if (implicit === undefined) {
      throw new ReferenceError(`Invalid reference ${source}`)
    } else {
      return implicit
    }
  }
}

/**
 * @template {{}|null} T
 * @param {Reference<T>} reference
 */
export const toBytes = (reference) => reference['/'].subarray(1)

/**
 * @template {{}|null} T
 * @template Out
 * @param {Reference<T>} reference
 */
export function* encode(reference) {
  yield reference['/'].subarray(1)
  return SIZE
}

/**
 * @param {Uint8Array} source
 */
export const fromBytes = (source) => {
  if (source[0] !== CODE) {
    throw new ReferenceError(`Invalid reference ${source}`)
  }

  if (source[1] !== SHA256_CODE) {
    throw new ReferenceError(`Unsupported hashing algorithm ${source[1]}`)
  }

  if (source[2] !== DIGEST_SIZE) {
    throw new ReferenceError(`Invalid digest size ${source[2]}`)
  }

  if (source.length < SIZE) {
    throw new RangeError(`Incomplete Reference byte sequence`)
  }

  return Reference.fromDigest(source.subarray(3, 3 + DIGEST_SIZE))
}

/**
 * @template {{}|null} T
 * @param {T} value
 * @returns {Reference<T>}
 */
export const of = (value) => /** @type {Reference<T>} */ (refer(value))

export { of as refer }
