import * as UTF8 from '../utf8.js'
import { Unsigned as Int } from './LEB128.js'
import { Text as Tag } from './tag.js'
import * as Type from './type.js'
import * as Error from './error.js'

/**
 * @param {string} source
 */
export function* encode(source) {
  const content = UTF8.toUTF8(source)
  const length = Int.toBytes(content.length)

  const prefix = new Uint8Array(length.byteLength + 1)
  prefix[0] = Tag.code
  prefix.set(length, 1)
  yield prefix
  yield content

  return prefix.byteLength + content.byteLength
}

/**
 *
 * @param {Type.BufferReader} buffer
 */
export function* decode(buffer) {
  yield* Tag.decode(buffer)

  const length = yield* Int.decode(buffer)
  const content =
    buffer.read(Number(length)) ??
    (yield* Error.incomplete({ segment: 'Text' }))

  return UTF8.fromUTF8(content)
}
