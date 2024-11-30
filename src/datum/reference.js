import * as Reference from 'merkle-reference'
import { Link } from 'datalogia'

export * from 'merkle-reference'

/**
 * @template {{}|null} T
 * @param {T} value
 * @returns {Reference.Reference<T>|T}
 */
export const from = (value) => {
  if (Link.is(value) && value['/'][1] === Reference.CODE) {
    return /** @type {Reference.Reference<T>} */ (
      Reference.fromDigest(value['/'].subarray(4))
    )
  } else {
    return value
  }
}

export const of = Reference.refer
