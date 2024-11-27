import * as Error from './error.js'
import * as Type from './type.js'
import { Float } from './tag.js'

const buffer = new ArrayBuffer(Float64Array.BYTES_PER_ELEMENT * 2)
const output = new Uint8Array(buffer, Float64Array.BYTES_PER_ELEMENT - 1)
output[0] = Float.code
const input = new Uint8Array(buffer, Float64Array.BYTES_PER_ELEMENT)
const view = new Float64Array(buffer, Float64Array.BYTES_PER_ELEMENT)
export const LENGTH = output.byteLength

/**
 * @param {number} source
 */
export const toBytes = (source) => {
  view[0] = source

  return output.slice(0)
}

/**
 * @param {number} source
 */
export function* encode(source) {
  yield toBytes(source)

  return LENGTH
}

/**
 * @param {Type.BufferReader} bytes
 */
export function* decode(bytes) {
  yield* Float.decode(bytes)
  let offset = 0

  while (offset < LENGTH) {
    input[offset] =
      bytes.take() ?? (yield* Error.incomplete({ segment: 'Float' }))
    offset++
  }

  return view[0]
}
