import * as Type from '../replica/type.js'
import * as Boolean from './boolean.js'
import * as Raw from './raw.js'
import * as Int from './integer.js'
import * as Float from './float.js'
import * as Text from './text.js'
import * as Reference from '../datum/reference.js'
import * as Buffer from './buffer.js'
import * as Null from './null.js'
import * as Tag from './tag.js'

/**
 * @param {Type.Scalar} source
 */
export const encode = (source) => {
  switch (typeof source) {
    case 'boolean':
      return Boolean.encode(source)
    case 'number':
      return Number.isInteger(source)
        ? Int.encode(source)
        : Float.encode(source)
    case 'bigint':
      return Int.encode(source)
    case 'string':
      return Text.encode(source)
    default: {
      if (source === null) {
        return Null.encode()
      } else if (source instanceof Uint8Array) {
        return Raw.encode(source)
      } else if (Reference.is(source)) {
        return Reference.encode(source)
      } else {
        throw new RangeError(`Unsupported data type ${source}`)
      }
    }
  }
}

class Pointer {}
/**
 *
 * @param {Uint8Array} source
 * @param {number} offset
 */
export function decode(source, offset = 0) {
  const tag = source[offset]
  switch (tag) {
    case Tag.Null:
      return [null, 1]
    case Tag.Boolean:
      return Boolean.decode(source, offset)
    case Tag.Integer:
      return Int.decode(source, offset)
    case Tag.Float:
      return Float.decode(source, offset)
    case Tag.Text:
      return Text.decode(source, offset)
    case Tag.Raw:
      return Raw.decode(source, offset)
    case Tag.Reference:
      return [Reference.fromBytes(source.subarray(offset)), Reference.SIZE]
    case Tag.Pointer:
      return [new Pointer(), offset + 1]
    default:
      throw new RangeError(`Unsupported data type ${tag}`)
  }
}
