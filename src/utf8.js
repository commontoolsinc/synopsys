const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export const fromUTF8 = (bytes) => decoder.decode(bytes)

/**
 * @param {string} string
 * @returns {Uint8Array}
 */
export const toUTF8 = (string) => encoder.encode(string)
