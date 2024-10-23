import { Reference, refer } from 'merkle-reference'
import { Link, API } from 'datalogia'

export const CODE = refer(null).code
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
 * @template {{}|null} T
 * @param {T} value
 * @returns {Reference<T>}
 */
export const of = (value) => /** @type {Reference<T>} */ (refer(value))
