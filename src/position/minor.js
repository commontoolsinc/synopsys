import * as Digits from './digits.js'
export { EQUAL, CONSECUTIVE } from './digits.js'
import * as Major from './major.js'
export const { base62: base } = Digits

export const MIN = base.min

export const MEDIAN = base.codes[(base.codes.length / 2) | 0]
export const MAX = base.max

/**
 * @param {Uint8Array} minor
 */
export const decrement = (minor) => Digits.decrement(minor, base.ranges)

/**
 * @param {Uint8Array} minor
 */
export const increment = (minor) => Digits.increment(minor, base.ranges)

/**
 * @param {Uint8Array} position
 */
export const from = (position) => {
  const length = Major.capacity(Major.from(position))
  const slice = position.subarray(1, 1 + length)
  // Position trim trailing mins of the minor component when there is no patch
  // component. If that is the case here we pad the minor component with min
  // values so that operations on digits will not make wrong assumptions about
  // the size.
  if (slice.length < length) {
    const minor = new Uint8Array(length).fill(base.min)
    minor.set(slice)
    return minor
  }
  return slice
}

/**
 *
 * @param {Uint8Array} lower
 * @param {Uint8Array} upper
 * @returns
 */
export const intermediate = (lower, upper) =>
  Digits.intermediate(lower, upper, base.ranges)

/**
 * @param {number} size
 */
export const max = (size) => new Uint8Array(size).fill(base.max)

/**
 * @param {Uint8Array} minor
 */
export const trim = (minor) => Digits.trim(minor, base.ranges)
