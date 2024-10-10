import * as Digits from './digits.js'
import * as Major from './major.js'
export const { CONSECUTIVE, EQUAL } = Digits
export const { base62: base } = Digits

export const MEDIAN = base.codes[(base.codes.length / 2) | 0]

/**
 * @typedef {Uint8Array & {Patch?: {}}} Patch
 */

/**
 * @param {Uint8Array} position
 * @returns {Patch}
 */
export const from = (position) =>
  position.subarray(Major.capacity(Major.from(position)) + 1)

/**
 * @returns {Patch}
 */
export const max = () => new Uint8Array([base.max + 1])

/**
 * @returns {Patch}
 */
export const min = () => new Uint8Array([base.min - 1])

/**
 * Returns an intermediate patch value that would sort between `lower` and
 * `upper`. Since patches are treated as fractions they can grow in size
 * which is what will happen if `lower` and `upper` are consecutive. If lower
 * and upper are the same function will return `null`.
 *
 * @param {Patch} low
 * @param {Patch} high
 * @returns {Patch|null}
 */
export const intermediate = (low, high) => {
  const digits = Digits.intermediate(low, high, base.ranges)
  // If lower and upper are consecutive, we can derive average by adding
  // another digit to the `lower` position. This would make it
  if (digits === Digits.CONSECUTIVE) {
    return increase(low)
  } else {
    return digits == Digits.EQUAL ? null : digits
  }
}

/**
 * @param {Patch} digits
 */
export const next = (digits) =>
  // We know it will never be equal because we pass the max value.
  /** @type {Patch} */ (intermediate(digits, max()))

/**
 * @param {Patch} digits
 * @returns {Patch}
 */
const increase = (digits) => {
  const patch = new Uint8Array(digits.length + 1)
  patch.set(digits)
  patch[digits.length] = MEDIAN
  return patch
}

/**
 * @param {Patch} digits
 * @returns {Patch|null}
 */
const decrease = (digits) => {
  let offset = digits.length - 1
  while (offset > 0 && digits[offset] === base.min) {
    offset--
  }

  if (offset <= 0) {
    return null
  } else {
    return digits.subarray(0, offset + 1)
  }
}

/**
 *
 * @param {Patch} digits
 * @returns {Patch}
 */
export const increment = (digits) =>
  Digits.increment(digits, base.ranges) ?? increase(digits)

/**
 * @param {Patch} digits
 * @returns {Patch|null}
 */
export const decrement = (digits) =>
  Digits.decrement(digits, base.ranges) ?? decrease(digits)

/**
 * @param {Patch} digits
 * @returns {Patch}
 */
export const trim = (digits) => Digits.trim(digits, base.ranges)
