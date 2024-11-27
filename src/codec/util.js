import * as Type from './type.js'
import * as Error from './error.js'

/**
 * @param {Iterable<Uint8Array>} chunks
 */
export function* frame(chunks) {
  let size = 0
  for (const chunk of chunks) {
    size += chunk.byteLength
    yield chunk
  }

  return size
}
