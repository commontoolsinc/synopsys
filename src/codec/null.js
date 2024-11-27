import { Null } from './tag.js'
import * as Type from './type.js'
import * as Error from './error.js'

const memory = new Uint8Array(Null.code)
export const toBytes = () => memory

export function* encode() {
  yield memory
  return memory.byteLength
}

/**
 * @param {Type.BufferReader} buffer
 */
export function* decode(buffer) {
  yield* Null.decode(buffer)

  return null
}
