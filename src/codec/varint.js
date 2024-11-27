import * as Type from './type.js'
import * as Error from './error.js'

const MSB = 0x80
const REST = 0x7f
const MSBALL = ~REST
const INT = Math.pow(2, 31)

/**
 * @param {number} source
 * @param {Uint8Array} buffer
 * @param {number} offset
 */
export function write(
  source,
  buffer = new Uint8Array(length(source)),
  offset = 0
) {
  const start = offset

  while (source >= INT) {
    buffer[offset++] = (source & 0xff) | MSB
    source /= 128
  }
  while (source & MSBALL) {
    buffer[offset++] = (source & 0xff) | MSB
    source >>>= 7
  }
  buffer[offset] = source | 0

  // @ts-ignore
  encode.bytes = offset - start + 1

  return buffer
}

/**
 * @param {Type.BufferReader} buffer
 */
export function* decode(buffer) {
  let result = 0
  let shift = 0
  let byte = 0
  let size = 0

  do {
    byte = buffer.take() ?? (yield* Error.incomplete({ segment: 'Varint' }))
    size += 1

    result +=
      shift < 28 ? (byte & REST) << shift : (byte & REST) * Math.pow(2, shift)
    shift += 7
  } while (byte >= MSB)

  return result
}

const N1 = Math.pow(2, 7)
const N2 = Math.pow(2, 14)
const N3 = Math.pow(2, 21)
const N4 = Math.pow(2, 28)
const N5 = Math.pow(2, 35)
const N6 = Math.pow(2, 42)
const N7 = Math.pow(2, 49)
const N8 = Math.pow(2, 56)
const N9 = Math.pow(2, 63)

/**
 * @param {number} value
 * @returns {number}
 */
export const length = (value) =>
  value < N1
    ? 1
    : value < N2
      ? 2
      : value < N3
        ? 3
        : value < N4
          ? 4
          : value < N5
            ? 5
            : value < N6
              ? 6
              : value < N7
                ? 7
                : value < N8
                  ? 8
                  : value < N9
                    ? 9
                    : 10
