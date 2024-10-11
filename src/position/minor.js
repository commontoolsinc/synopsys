import * as Digits from './digits.js'
import * as Base from './base.js'
export { EQUAL, CONSECUTIVE } from './digits.js'
import * as Major from './major.js'
export const { base62: base } = Digits

export const MIN = Base.min(base)
export const MAX = Base.max(base)
export const MEDIAN = Base.median(base)

/**
 * @typedef {Uint8Array & {Minor?: {}}} Minor
 */

/**
 * @param {Minor} minor
 */
export const decrement = (minor) => Digits.decrement(minor, base.ranges)

/**
 * @param {Minor} minor
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
    const minor = new Uint8Array(length).fill(MIN)
    minor.set(slice)
    return minor
  }
  return slice
}

/**
 *
 * @param {Minor} low
 * @param {Minor} high
 * @returns
 */
export const intermediate = (low, high) =>
  Digits.intermediate(low, high, base.ranges)

/**
 * @param {number} size
 */
export const max = (size) => new Uint8Array(size).fill(MAX)

/**
 *
 * @param {number} size
 */
export const min = (size) => new Uint8Array(size).fill(MIN)
/**
 * @param {Minor} minor
 */
export const trim = (minor) => Digits.trim(minor, base.ranges)
