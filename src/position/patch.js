import * as Digits from './digits.js'
import * as Major from './major.js'
import * as Base from './base.js'
export const { CONSECUTIVE, EQUAL } = Digits
export const { base62: base } = Digits

export const MIN = Base.min(base)
export const MAX = Base.max(base)

export const MEDIAN = Base.median(base)

/**
 * Type signifying a digits in the base64 character set representing a patch
 * component of the position.
 *
 * @typedef {Digits.Digits<Digits.B62>} Patch
 */
/**
 * @typedef {Digits.Digits<Digits.B62>} Bias
 */

/**
 * @param {Uint8Array} position
 * @returns {Patch}
 */
export const from = (position) =>
  /** @type {Patch} */ (
    position.subarray(Major.capacity(Major.from(position)) + 1)
  )

/**
 * @returns {Patch}
 */
export const max = () => new Uint8Array([MAX + 1])

/**
 * @returns {Patch}
 */
export const min = () => new Uint8Array([MIN - 1])

const median = new Uint8Array([MEDIAN])

/**
 * Returns an intermediate patch value that would sort between `lower` and
 * `upper`. Since patches are treated as fractions they can grow in size
 * which is what will happen if `lower` and `upper` are consecutive. If lower
 * and upper are the same function will return `null`.
 *
 * @param {Patch} low
 * @param {Patch} high
 * @param {Bias} bias
 * @returns {Patch|null}
 */
export const intermediate = (low, high, bias) => {
  const digits = Digits.intermediate(low, high, base.ranges)
  switch (digits) {
    case Digits.EQUAL:
      return null
    case Digits.CONSECUTIVE:
      // If lower and upper are consecutive, we can derive average by
      // appending bias to the `lower` position. This will ensure that
      // the patch is always greater than the `lower` and less than the
      // `upper` position. However if bias is not provided we may end up
      // with a patch that is equal to the `lower` position which is why
      // we append `median` in such case.
      return append(low, bias.length > 0 ? bias : median)
    default: {
      const head = bias[0]
      // If bias is empty we can return the intermediate digits as is.
      if (head == null) {
        return digits
      }

      // Otherwise we will adjust an intermediate digits with the bias.
      // If we have an intermediate position, only it's last digit will be
      // between `low` and `high` digits at the same offset.
      const offset = digits.length - 1
      // If head of the bias fits between the low and high digits we can
      // override tie breaking digit.
      const delta = low[offset] < head && head < high[offset] ? 1 : 0

      const patch = new Uint8Array(digits.length + bias.length - delta)
      patch.set(digits)
      patch.set(bias, digits.length - delta)
      return patch
    }
  }
}

/**
 * @param {Patch} digits
 * @param {Bias} bias
 */
export const next = (digits, bias) =>
  intermediate(digits, max(), bias) || append(digits, bias)

/**
 * @param {Patch} digits
 * @param {Patch} extra
 * @returns {Patch}
 */
const append = (digits, extra) => {
  const patch = new Uint8Array(digits.length + extra.length)
  patch.set(digits)
  patch.set(extra, digits.length)
  return patch
}

/**
 * @param {Patch} digits
 * @returns {Patch|null}
 */
const decrease = (digits) => {
  let offset = digits.length - 1
  while (offset > 0 && digits[offset] === MIN) {
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
 * @param {Patch} patch
 * @param {Bias} bias
 * @returns {Patch}
 */
export const increment = (patch, bias) => {
  const digits = Digits.increment(patch, base.ranges)
  const [head] = bias
  if (digits == null) {
    return append(patch, median)
  } else if (head == null) {
    return digits
  } else if (head >= digits[0]) {
    return bias
  } else {
    return append(digits, bias)
  }
}

/**
 * @param {Patch} patch
 * @param {Bias} bias
 * @returns {Patch|null}
 */
export const decrement = (patch, bias) => {
  const digits = Digits.decrement(patch, base.ranges)
  const [head] = bias
  if (digits == null) {
    return decrease(patch)
  } else if (head == null) {
    return digits
  } else if (head <= digits[0]) {
    return bias
  } else {
    return append(digits, bias)
  }
}

/**
 * @param {Patch} digits
 * @returns {Patch}
 */
export const trim = (digits) => Digits.trim(digits, base.ranges)
