/**
 * Just a type alias so we can better communicate intended type.
 * @typedef {number & {Uint8?:{}}} Uint8
 */

/**
 * @template {Uint8} [T=Uint8]
 * @typedef {readonly [from:T, to:T]} Range
 */

/**
 * @template {Uint8} [T=Uint8]
 * @typedef {readonly [Range<T>, ...Range<T>[]]} Ranges
 */

/**
 * @template {Uint8} [Code=Uint8]
 * @typedef Base
 * @property {[Code, ...Code[]]} codes
 * @property {Ranges<Code>} ranges
 */
/**
 * Parses a base description string and generates an ordered list of [from, to] ranges.
 *
 * @template {Uint8} [Code=Uint8]
 * @param {string} alphabet - A string containing all characters in the base.
 * @returns {Base<Code>}
 */
export const parse = (alphabet) => {
  const { length } = alphabet
  if (length === 0 || length > 255) {
    throw new RangeError(`Invalid base alphabet length: ${length}`)
  }

  // Sort the characters in ascending order of their character codes.
  const codes = [...alphabet].map((char) => char.charCodeAt(0))

  /** @type {Range[]} */
  const ranges = []
  let [startCharCode, ...sortedCodes] = [...new Set(codes)].sort(
    (a, b) => a - b
  )
  let endCharCode = startCharCode

  for (const charCode of sortedCodes) {
    // If the character codes are consecutive, extend the current range.
    if (charCode === endCharCode + 1) {
      endCharCode = charCode
    }
    // If the character codes are not consecutive, start a new range.
    else {
      ranges.push([startCharCode, endCharCode])
      startCharCode = charCode
      endCharCode = charCode
    }
  }

  // Don't forget to push the last range.
  ranges.push([startCharCode, endCharCode])

  return {
    codes: /** @type {[Code, ...Code[]]} */ (codes),
    /** @type {Ranges<Code>} */
    ranges: /** @type {[Range<Code>, ...Range<Code>[]]} */ (ranges),
  }
}

/**
 * @param {Base} base
 * @returns {Uint8}
 */
export const min = ({ ranges }) => ranges[0][0]

/**
 * @param {Base} base
 * @returns {Uint8}
 */
export const max = ({ ranges }) => ranges[ranges.length - 1][1]

/**
 * @param {Base} base
 */
export const median = ({ codes }) =>
  [...codes].sort((a, b) => a - b)[(codes.length / 2) | 0]

/**
 * Converts a byte array to a digit array in a given base.
 *
 * @param {ArrayLike<Uint8> & Iterable<Uint8>} bytes
 * @param {Base} base
 */
export const toBase = (bytes, base) => {
  // encoding_flag:
  //  - 0: counting leading zeros
  //  - 1: processing
  let flag = 0
  let leadingZeros = 0
  let encoding = []
  const n = base.codes.length

  for (let byte of bytes) {
    if (!(flag || byte)) {
      leadingZeros++
    } else {
      flag = 1
    }

    let carry = byte
    for (let i = 0; carry || i < encoding.length; i++) {
      carry += encoding[i] << 8
      encoding[i] = carry % n
      carry = (carry / n) | 0
    }
  }

  let len = leadingZeros + encoding.length
  let digits = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    digits[i] = base.codes[i < leadingZeros ? 0 : encoding[len - i - 1]]
  }

  return digits
}
