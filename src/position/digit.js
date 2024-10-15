import { values } from './iterator.js'
import * as Base from './base.js'
export const EQUAL = Symbol.for('EQUAL')
export const CONSECUTIVE = Symbol.for('CONSECUTIVE')

/**
 * @typedef {import('./base.js').Ranges} Ranges
 */

/**
 * Just a type alias so we can better communicate intended type. It is a
 * negative integer that signals that corresponding Uint8 fall out of bounds.
 *
 * @typedef {number & {OutOfBound?:{}}} OutOfBound
 */

/**
 * Increments a single digit such that it falls within the given ranges. If
 * incremented digit falls between ranges it will be rounded up to the smallest
 * digit in the next range. If incremented digit falls out of bounds it will
 * return `OutOfBound`.
 *
 * @template {Base.Uint8} [Digit=Base.Uint8]
 * @param {Digit} digit - The digit to increment.
 * @param {Base.Ranges<Digit>} ranges - The ranges of valid digit values.
 * @returns {Digit|OutOfBound} The incremented digit, or -1 if the digit falls out of bounds.
 */
export const increment = (digit, ranges) => {
  const subsequent = digit + 1

  // Otherwise we go over each range to find the one subsequent digit will fall
  // into.
  for (const [from, to] of ranges) {
    // If character is below this range it must be falling between ranges
    // so we just round it up to the smallest digit in this range.
    if (subsequent < from) {
      return from
    }
    // If character is within this range great then we just return it
    else if (subsequent <= to) {
      return subsequent
    }
    // Otherwise we're going to move on to the next range.
  }

  // If we got here digit is out of bounds and we return -1 to signal it.
  return -subsequent
}

/**
 * Decrements a single digit within the given ranges. If the decremented digit
 * falls between ranges it will be rounded down to the largest digit in the
 * previous range. If the decremented digit falls out of bounds it will return
 * -
 *
 * @template {Base.Uint8} [Digit=Base.Uint8]
 * @param {Digit} digit - The digit to decrement.
 * @param {Base.Ranges<Digit>} ranges - The ranges of valid digit values.
 * @returns {Digit|OutOfBound} The decremented digit, or -1 if digit falls out of bounds.
 */
export const decrement = (digit, ranges) => {
  const subsequent = digit - 1

  // Iterate over each range in reverse order.
  for (const [from, to] of values.reverse(ranges)) {
    // If the character is above this range, it must be falling between ranges,
    // so we just round it down to the largest digit in this range.
    if (subsequent > to) {
      return to
    }
    // If the character is within this range, we just return it.
    else if (subsequent >= from) {
      return subsequent
    }
    // Otherwise, we're going to move on to the previous range.
  }

  // If we got here, the digit is out of bounds and we return -1 to signal it.
  return -subsequent
}

/**
 * Finds an intermediate digit between the given two with a constraint that
 * it fits passed ranges. Return positive value if the valid intermediate digit
 * exists, otherwise returns a negative of the average of the two digits to
 * signal that it falls out of the given ranges.
 *
 * @template {Digit} From
 * @template {Digit} To
 * @template {Base.Uint8} [Digit=Base.Uint8]
 * @param {From} from - The first digit for the average calculation.
 * @param {To} to - The second digit for the average calculation.
 * @param {Base.Ranges<Digit>} ranges - The ranges of valid digit values.
 * @returns {Digit|EQUAL|CONSECUTIVE}
 */
export const intermediate = (from, to, ranges) => {
  // Figure out which digit is lower and which one is higher.
  const [bottom, top] = from > to ? [to, from] : [from, to]

  // If the two digits are equal we return `EQUAL as there will be no
  // intermediate value between the two.
  if (bottom === top) {
    return EQUAL
  }
  // If the delta between the two digits is 1 they are consecutive and we can
  // not find an intermediate value between them either.
  else if (top - bottom === 1) {
    return CONSECUTIVE
  }

  // Otherwise way may have a chance for finding a consecutive digit.
  const digit = Math.round((top + bottom) / 2)

  let last = null
  // Intermediate digit may fall out of bounds however in which case we will
  // want to round up or down to to fall into the recommended ranges.
  for (const [low, high] of ranges) {
    // If digit is below this range we attempt to round it up to the low bound
    // of this range.
    if (digit < low) {
      // Attempting to round up to the `lower` bound of the this range.
      if (bottom < low && low < top) {
        return low
      }
      // If rounded up digit (low) falls outside the `bottom..top` range attempt
      // to to round it down to the `last` bound of the previous range.
      else if (last != null && bottom < last && last < high) {
        return last
      }
      // If rounding it up and rounding it down both fail we conclude that `from`
      // and `to` ar consecutive and we return `CONSECUTIVE`. This could be the
      // case if they are between two ranges or their bounds.
      else {
        return CONSECUTIVE
      }
    }

    // If digit is within the bounds of this range we return it.
    if (low <= digit && digit <= high) {
      return /** @type {Digit} */ (digit)
    }

    last = high
  }

  // If we got here digit must be greater than the upper bound of the last
  // range. If so we do check if rounding it down to the upper bound of the last
  // range would make it fall between `bottom` and `top`.
  if (last != null && bottom < last && last < top) {
    return last
  }
  // If last bound falls outside the `bottom..top` then both `from` and `to` are
  // out of the range bounds and can be considered consecutive as all digits out
  // of range are considered consecutive.
  else {
    return CONSECUTIVE
  }
}
