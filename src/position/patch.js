import * as Digits from './digits.js'
import * as Major from './major.js'
export const { CONSECUTIVE, EQUAL } = Digits
export const { base62: base } = Digits

export const MEDIAN = base.codes[(base.codes.length / 2) | 0]

/**
 * @param {Uint8Array} position
 */
export const from = (position) =>
  position.subarray(Major.capacity(Major.from(position)) + 1)

/**
 *
 * @param {Digits.Uint8} size
 */
export const max = (size) => new Uint8Array(size).fill(base.max)

/**
 * Returns an intermediate patch value that would sort between `lower` and
 * `upper`. Since patches are treated as fractions they can grow in size
 * which is what will happen if `lower` and `upper` are consecutive. If lower
 * and upper are the same function will return `null`.
 *
 * @param {Uint8Array} lower
 * @param {Uint8Array} upper
 */
export const intermediate = (lower, upper) => {
  const digits = Digits.intermediate(lower, upper, base.ranges)
  // If lower and upper are consecutive, we can derive average by adding
  // another digit to the `lower` position. This would make it
  if (digits === Digits.CONSECUTIVE) {
    return increase(lower)
  } else {
    return digits == Digits.EQUAL ? null : digits
  }
}

/**
 * @param {Uint8Array} digits
 */
const increase = (digits) => {
  const patch = new Uint8Array(digits.length + 1)
  patch.set(digits)
  patch[digits.length] = MEDIAN
  return patch
}

/**
 * @param {Uint8Array} digits
 */
const decrease = (digits) => {
  let offset = digits.length - 1
  while (offset > 0 && digits[offset] === base.min) {
    offset--
  }

  if (offset === 0) {
    return null
  } else {
    return digits.subarray(0, offset)
  }
}

/**
 *
 * @param {Uint8Array} digits
 * @returns
 */
export const increment = (digits) =>
  Digits.increment(digits, base.ranges) ?? increase(digits)

/**
 * @param {Uint8Array} digits
 * @returns
 */
export const decrement = (digits) =>
  Digits.decrement(digits, base.ranges) ?? decrease(digits)

/**
 * @param {Uint8Array} digits
 */
export const trim = (digits) => Digits.trim(digits, base.ranges)
