import { Reference, refer, base32 } from 'merkle-reference'
import { Link, API } from 'datalogia'

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
    if (
      bytes[0] === CODE &&
      bytes[1] === SHA256_CODE &&
      bytes[2] === DIGEST_SIZE &&
      bytes.length === SIZE
    ) {
      return Reference.fromDigest(bytes.subarray(3))
    } else {
      throw new ReferenceError(
        `Invalid reference, expected a reference instead got ${source}`
      )
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
 * @param {T} value
 * @returns {Reference<T>}
 */
export const of = (value) => /** @type {Reference<T>} */ (refer(value))

export { of as refer }
