import * as Digit from './digit.js'
import * as Base from './base.js'
import { CONSECUTIVE, EQUAL } from './digit.js'
export { toBase } from './base.js'

export { CONSECUTIVE, EQUAL } from './digit.js'

/**
 * Type signifying a unsigned 8-bit integer.
 *
 * @typedef {import('./base.js').Uint8} Uint8
 */

/**
 * Type signifying a digit in the base62 character set.
 * @typedef {Uint8 & {Base64?:{}}} B62
 */

/**
 * Type signifying a digits in the base52 character set.
 * @typedef {Uint8 & {Base52?:{}}} B52
 */

/**
 * @template {Uint8} [T=Uint8]
 * @typedef {Uint8Array & {[key: number]: T}} Digits
 */

/**
 * These are the supported major zones when incrementing digit between the
 * zones it will produce a digit in the next zone.
 */
/** @type {Base.Base<B62>} */
export const base62 = Base.parse(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  // '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
)

/** @type {Base.Base<B52>} */
export const base52 = Base.parse(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
)

/**
 * @param {Digits} source
 */
export const toString = (source) => new TextDecoder().decode(source)

/**
 * @param {string} source
 */
export const fromString = (source) => new TextEncoder().encode(source)

/**
 * @param {ArrayLike<Uint8>} source
 */
export const fromArray = (source) => {
  const major = new Uint8Array(source.length)
  major.set(source)
  return major
}

/**
 * Takes an byte array representing position as fixed set of digits and returns
 * a new byte array with the incremented value. Function ensures that returned
 * byte array bytes that are in the base62 range, when increment falls out of
 * the range it will either round up to the next digit that would fit the range
 * or return null if it is not possible to increment the number further with in
 * the current byte array capacity.
 *
 * @template {Digits<Uint8>} [T=Digits<Uint8>]
 * @param {T} source
 * @param {Base.Ranges} base
 * @returns {T|null}
 */
export const increment = (source, base) => {
  // Create a new Digits instance to avoid mutating the original one.
  let digits = new Uint8Array(source)

  // Iterate over the digits in reverse order (from least significant to most significant).
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Digit.increment(digits[i], base)
    // If digit is -1, we have a carry. Otherwise, no carry.
    if (digit < 0) {
      // If the digit is already at the maximum value in its range, we have a carry.
      // Reset the digit to the minimum value in its range.
      digits[i] = base[0][0]
    } else {
      // Otherwise, no carry, so we can break the loop early.
      digits[i] = digit
      return /** @type {T} */ (digits)
    }
  }

  // If we have not returned from the loop we are unable to increment the number
  // further as we are at the maximum capacity in this byte array. It such case
  // we return null letting the caller know that incrementing is not possible.
  return null
}

/**
 * Takes a byte array representing a position as a fixed set of digits and returns
 * a new byte array with the decremented value. The function ensures that the returned
 * byte array bytes are in the base62 range. When decrementing falls out of
 * the range, it will either round down to the previous digit that would fit the range
 * or return null if it is not possible to decrement the number further with the
 * current byte array capacity.
 *
 * @template {Digits<Uint8>} [T=Digits<Uint8>]
 * @param {T} source
 * @param {Base.Ranges} base
 * @returns {T|null} The decremented digits as a byte array, or null if decrementing was not possible.
 */
export const decrement = (source, base) => {
  // Create a new Uint8Array instance to avoid mutating the original one.
  let digits = new Uint8Array(source)

  // Iterate over the digits in reverse order (from least significant to most significant).
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Digit.decrement(digits[i], base)
    // If digit is -1, we have a "borrow". Otherwise, no "borrow".
    if (digit < 0) {
      // If the digit is already at the minimum value in its range, we have a "borrow".
      // Reset the digit to the maximum value in its range.
      digits[i] = base[base.length - 1][1]
    } else {
      // Otherwise, no "borrow", so we can break the loop early.
      digits[i] = digit
      return /** @type {T} */ (digits)
    }
  }

  // If we have not returned from the loop, we are unable to decrement the number
  // further as we are at the minimum capacity in this byte array. In such case,
  // we return null, letting the caller know that decrementing is not possible.
  return null
}

/**
 * Computes an average between two digits that would fit given ranges. If both
 * digits are equal or consecutive it will not be able to derive an average and
 * will return null. Otherwise, it will return a new byte array with the average
 * digit. Returned digit may be shorter than the input digits because trailing
 * `min` values are implied.
 *
 * @template {Digits<Uint8>} [T=Digits<Uint8>]
 * @param {T} begin
 * @param {T} end
 * @param {Base.Ranges} ranges - The ranges of valid digit values.
 * @returns {T|EQUAL|CONSECUTIVE}
 */
export const intermediate = (begin, end, ranges) => {
  const min = ranges[0][0] // Minimum value from the ranges
  const max = ranges[ranges.length - 1][1] // Maximum value from the ranges

  // Allocate the byte array in size of the longer boundary.
  const digits = new Uint8Array(Math.max(begin.length, end.length))
  // Copy the digits that are in common at the beginning.
  let offset = 0
  while (offset < digits.length) {
    // Digits can be trimmed to omit trailing min values, which is why we
    // implicitly assume min value when the digit is not present.
    const lower = begin[offset] ?? min
    const upper = end[offset] ?? min
    if (lower === upper) {
      digits[offset] = lower
      offset++
    } else {
      break
    }
  }

  // If we offset has reached the end begin boundaries are equal.
  if (offset === digits.length) {
    return EQUAL
  }

  // Otherwise they aren't equal and we determine which one is the greater
  // just in case begin and end are in reverse order.
  const [from, to] =
    (begin[offset] ?? min) < (end[offset] ?? min) ? [begin, end] : [end, begin]

  // Next we will copy all low digits until we find non-consecutive digit between
  // low and high.
  while (offset < digits.length) {
    const low = from[offset] ?? min
    const high = to[offset] ?? max + 1
    const digit = Digit.intermediate(low, high, ranges)

    // If we can not find intermediate digit we store the lower digit and
    // continue to the next digit.
    if (digit === EQUAL || digit === CONSECUTIVE) {
      digits[offset] = low
      offset++
    }
    // If we do find a non-consecutive digit we store it and return only
    // the slice of the digits that we have filled. We do not need to find
    // the intermediate digit for the rest of the digits as position will
    // fall in range and will be shorter this way.
    else {
      digits[offset] = digit
      return /** @type {T} */ (digits.subarray(0, offset + 1))
    }
  }

  // If we filled the digits, but have not found a non-consecutive one we
  // conclude that the given `begin` and `end` are consecutive.
  return CONSECUTIVE
}

/**
 * Removes trailing min values from the given digits.
 *
 * @template {Digits<Uint8>} [T=Digits<Uint8>]
 * @param {T} digits
 * @param {Base.Ranges} ranges - The ranges of valid digit values.
 * @returns {T}
 */
export const trim = (digits, ranges) => {
  const min = ranges[0][0] // Minimum value from the ranges
  let length = digits.length
  while (length > 0) {
    if (digits[length - 1] === min) {
      length--
    } else {
      break
    }
  }

  return length === digits.length
    ? digits
    : /** @type {T} */ (
        new Uint8Array(digits.buffer, digits.byteOffset, length)
      )
}
