import * as Digit from './digit.js'
import * as Base from './base.js'

/**
 * @typedef {import('./base.js').Uint8} Uint8
 */

/**
 * These are the supported major zones when incrementing digit between the
 * zones it will produce a digit in the next zone.
 */
export const base62 = Base.parse(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
)

export const base58 = Base.parse(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
)

/**
 * @param {Uint8Array} source
 */
export const toString = (source) => new TextDecoder().decode(source)

/**
 * @param {string} source
 */
export const fromString = (source) => new TextEncoder().encode(source)

/**
 * @param {ArrayLike<number>} source
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
 * @param {Uint8Array} source
 * @param {Base.Ranges} base
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
      return digits
    }
  }

  // If we have not returned from the loop we are unable to increment the number
  // further as we are at the maximum capacity in this byte array. It such case
  // we return null letting the caller know that incrementing is not possible.
  return null
  // // If we have not returned from the loop we still have to increment. In such
  // // case, we need to add a new digit to the end of the byte array to increase
  // // it's fraction.
  // let newDigits = new Uint8Array(digits.length + 1)
  // newDigits.set(digits) // Copies digits into newDigits.
  // newDigits[digits.length] = source.base[0][0] // Set the new digit to the minimum value in its range.

  // return Digits.new(
  //   newDigits.buffer,
  //   newDigits.byteOffset,
  //   newDigits.length,
  //   source.base
  // )
}

/**
 * Takes a byte array representing a position as a fixed set of digits and returns
 * a new byte array with the decremented value. The function ensures that the returned
 * byte array bytes are in the base62 range. When decrementing falls out of
 * the range, it will either round down to the previous digit that would fit the range
 * or return null if it is not possible to decrement the number further with the
 * current byte array capacity.
 *
 * @param {Uint8Array} source
 * @param {Base.Ranges} base
 * @returns {Uint8Array|null} The decremented digits as a byte array, or null if decrementing was not possible.
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
      return digits
    }
  }

  // If we have not returned from the loop, we are unable to decrement the number
  // further as we are at the minimum capacity in this byte array. In such case,
  // we return null, letting the caller know that decrementing is not possible.
  return null
}

export const EQUAL = Symbol.for('EQUAL')
export const CONSECUTIVE = Symbol.for('CONSECUTIVE')

/**
 * Computes an average between two digits that would fit given ranges. If both
 * digits are equal or consecutive it will not be able to derive an average and
 * will return null. Otherwise, it will return a new byte array with the average
 * digit. Returned digit may be shorter than the input digits because trailing
 * `min` values are implied.
 *
 * @param {Uint8Array} begin
 * @param {Uint8Array} end
 * @param {Base.Ranges} ranges - The ranges of valid digit values.
 */
export const intermediate = (begin, end, ranges) => {
  const min = ranges[0][0] // Minimum value from the ranges
  const max = ranges[ranges.length - 1][1] // Maximum value from the ranges

  // Allocate the byte array for to match the length of the longer out of the two.
  const digits = new Uint8Array(Math.max(begin.length, end.length))
  // Copy the digits that are in common at the beginning.
  let offset = 0
  while (offset < digits.length) {
    const lower = begin[offset] ?? min
    const upper = end[offset] ?? min
    if (lower === upper) {
      digits[offset] = lower
      offset++
    } else {
      break
    }
  }

  // If we offset has reached the end begin and end are equal.
  if (offset === digits.length) {
    return EQUAL
  }

  // Otherwise they aren't equal and we determine which one is the greater.
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
    } else {
      digits[offset] = digit
      return digits.subarray(0, offset + 1)
    }
  }

  // If we filled the digits, but have not found a non-consecutive one we
  // conclude that the given `begin` and `end` are consecutive.
  return CONSECUTIVE
}

/**
 * Removes trailing min values from the given digits.
 *
 * @param {Uint8Array} digits
 * @param {Base.Ranges} ranges - The ranges of valid digit values.
 * @returns {Uint8Array}
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
    : new Uint8Array(digits.buffer, digits.byteOffset, length)
}
