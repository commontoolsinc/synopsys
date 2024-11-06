/**
 * Encodes given integer in a LEB128 format into a given byte array
 * starting at a given offset.
 *
 * @param {bigint} value
 * @param {Uint8Array} bytes
 * @param {number} offset
 */
export const encode = (value, bytes, offset = 0) => {
  let more = true
  while (more) {
    let byte = value & 0x7fn
    value >>= 7n
    if (
      (value === 0n && (byte & 0x40n) === 0n) ||
      (value === -1n && (byte & 0x40n) !== 0n)
    ) {
      more = false
    } else {
      byte |= 0x80n
    }

    bytes[offset] = Number(byte)
    offset += 1
  }

  return offset
}

/**
 * Decodes a variable-length encoded integer from a byte array starting at a given offset.
 * The encoding uses a continuation bit in the high-order bit of each byte.
 *
 * @param {Uint8Array} bytes - The byte array containing the encoded integer.
 * @param {number} offset - The starting position in the array from which to begin decoding.
 * @returns {[bigint, number]} - The decoded integer and the new offset.
 * @throws {Error} - If the input is empty, invalid, or the offset is out of bounds.
 */
export const decode = (bytes, offset = 0) => {
  if (offset < 0 || offset >= bytes.length) {
    throw new RangeError('Invalid offset: Out of bounds')
  }

  let result = BigInt(0)
  let shift = 0n

  while (offset < bytes.length) {
    const byte = bytes[offset]
    offset += 1

    // Extract the low-order 7 bits of the byte
    const lowOrderBits = BigInt(byte & 0x7f)
    result |= lowOrderBits << shift

    // If the high-order bit is not set, we've reached the end
    if ((byte & 0x80) === 0) {
      break
    }

    shift += 7n
  }

  return [result, offset]
}
