/**
 * Just a type alias so we can better communicate intended type.
 * @typedef {number & {Uint8?:{}}} Uint8
 */

/**
 * @typedef {readonly [from:Uint8, to:Uint8]} Range
 * @typedef {readonly [Range, ...Range[]]} Ranges
 */

/**
 * Parses a base description string and generates an ordered list of [from, to] ranges.
 * @param {string} descriptor - A string containing all characters in the base.
 */
export const parse = (descriptor) => {
  // Sort the characters in ascending order of their character codes.
  let codes = [...new Set(descriptor)]
    .sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0))
    .map((char) => char.charCodeAt(0))

  /** @type {Range[]} */
  let ranges = []
  let startCharCode = codes[0]
  let endCharCode = startCharCode

  for (let i = 1; i < codes.length; i++) {
    let charCode = codes[i]

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
    min: ranges[0][0],
    max: ranges[ranges.length - 1][1],
    codes,
    /** @type {Ranges} */
    ranges: /** @type {[Range, ...Range[]]} */ (ranges),
  }
}
