/**
 * @typedef {import('./base.js').Uint8} Uint8
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
 * @param {Uint8} digit - The digit to increment.
 * @param {Ranges} ranges - The ranges of valid digit values.
 * @returns {Uint8|OutOfBound} The incremented digit, or -1 if the digit falls out of bounds.
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
 * @param {Uint8} digit - The digit to decrement.
 * @param {Ranges} ranges - The ranges of valid digit values.
 * @returns {Uint8|OutOfBound} The decremented digit, or -1 if digit falls out of bounds.
 */
export const decrement = (digit, ranges) => {
  const subsequent = digit - 1

  // Iterate over each range in reverse order.
  for (let i = ranges.length - 1; i >= 0; i--) {
    const [from, to] = ranges[i]
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
 * @param {Uint8} from - The first digit for the average calculation.
 * @param {Uint8} to - The second digit for the average calculation.
 * @param {Ranges} ranges - The ranges of valid digit values.
 * @returns {Uint8|OutOfBound}
 */
export const intermediate = (from, to, ranges) => {
  const [low, high] = from > to ? [to, from] : [from, to]
  // Calculate the average of the two digits.
  const intermediate = Math.floor((from + to) / 2)

  // Ensure that the average digit is within the valid ranges.
  for (const [at, [from, to]] of ranges.entries()) {
    // If the average digit is below this range we attempt to round up to the
    // smallest digit in this range. If that falls out of `low..high` bounds we
    // attempt to round down to the upper bound of the previous range. If that
    // falls out of bounds also we just return `-1 * average` signaling that no
    // average can fit the constraints.
    if (intermediate < from) {
      const [, upper] = ranges[at - 1] ?? [, -1]
      // Attempting to round up to the lower bound of the this range.
      if (from > low && from < high) {
        return from
      }
      // Attempt to round down to the upper bound of the last range.
      else if (upper > low && upper < high) {
        return upper
      }
      // We will not be able to find a average that falls in our ranges. If the
      // `upper === low` we return -low, that way caller can tell it does not
      // satisfy the constraints, but often they would still use `low` as base
      // and find average in the next segment.
      else if (upper === low) {
        return -low
      }
      // If rounding down missed the range we attempt the same with rounded up
      // value.
      else if (from === high) {
        return -from
      }
      // If both rounding up and down falls out of the range that implies that
      // both `from` and `to` were between ranges in which case we just return
      // `-1 * average`. This is a signal that no valid average can be found,
      // yet caller can still choose to use actual average.
      else {
        return -intermediate
      }
    }

    // If average is within this range we found it and we simply return.
    if (intermediate >= from && intermediate <= to) {
      return intermediate
    }
  }

  // If got here `average` is greater than upper bound of our last range. We
  // attempt to round it down to the upper bound of the last range. If that
  // falls within `low..high` bounds we return it, otherwise our `low` is
  // passed the upper bound of the last range and we return `-1 * average`.
  const max = ranges[ranges.length - 1][1]
  if (max > low && max < high) {
    return max
  } else {
    return -intermediate
  }
}
