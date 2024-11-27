import * as Offset from './LEB128/signed.js'
import * as Scalar from './scalar.js'
import * as Type from './type.js'
import { refer } from '../datum/reference.js'
import * as Tag from './tag.js'
import * as Error from './error.js'

export const MIN_LENGTH_FOR_POINTER = 5

/**
 * @template {{}|null} Return
 * @template {globalThis.Error} Throw
 * @param {Type.Job<Return, Throw>} job
 * @returns {Type.Job<[ok: Return, error:undefined]|[ok:undefined, error:Throw], never>}
 */
function* result(job) {
  try {
    const invocation = job[Symbol.iterator]()
    while (true) {
      const next = invocation.next()
      if (next.done) {
        return [next.value, undefined]
      } else {
        return [undefined, next.value]
      }
    }
  } catch (error) {
    return [undefined, /** @type {Throw} */ (error)]
  }
}

/**
 * @implements {Type.BufferReader}
 */
export class BufferReader {
  /**
   * @param {Uint8Array} source
   * @param {number} offset
   */
  constructor(source, offset = 0) {
    this.source = source
    this.byteOffset = offset
  }
  /**
   * @param {number} offset
   */
  at(offset) {
    return this.source[this.byteOffset + offset]
  }

  take() {
    if (this.byteOffset < this.source.length) {
      return this.source[this.byteOffset++]
    } else {
      return undefined
    }
  }

  /**
   * @param {number} size
   */
  read(size) {
    if (this.byteOffset + size) {
      return this.source.subarray(this.byteOffset, this.byteOffset + size)
    } else {
      return undefined
    }
  }

  /**
   * @template Ok
   * @template {globalThis.Error} Error
   * @param {(buffer: Type.BufferReader) => Type.Job<Ok, Error>} read
   * @returns {Type.Job<Ok, Error>}
   */
  *do(read) {
    let { byteOffset } = this
    try {
      return yield* read(this)
    } catch (error) {
      this.byteOffset = byteOffset
      throw error
    }
  }
}

export class Pointer {
  /**
   * @param {number} offset
   */
  constructor(offset) {
    this.offset = offset
  }
  /**
   * @param {number} offset
   */
  *encode(offset) {
    const content = Offset.encode(offset - this.offset, 1)
    content[0] = Tag.Pointer.code

    yield content
    return content.byteLength
  }

  /**
   *
   * @param {Type.BufferReader} buffer
   * @returns {Type.Job<Pointer, Type.DecodeError>}
   */
  static *decode(buffer) {
    yield* Tag.Pointer.decode(buffer)

    const tag = buffer.take()
    if (tag !== Tag.Pointer.code) {
      return yield* Error.invalid({
        segment: 'Pointer',
        expect: Tag.Pointer.code,
        actual: tag,
        at: buffer.byteOffset,
      })
    } else {
      const pointer = yield* Offset.decode(buffer)
      return new Pointer(Number(pointer))
    }
  }

  /**
   * @template T
   * @param {Map<number, T>} cache
   */
  resolve(cache) {
    return cache.get(this.offset)
  }

  // /**
  //  * @template T
  //  * @param {Uint8Array} source
  //  * @param {number} offset
  //  */
  // static decode(source, offset) {
  //   const pointer = Offset.decode(source, offset)

  //   const content = cache.get(offset)
  //   if (content !== undefined) {
  //     return content
  //   } else {
  //     throw new RangeError(`Invalid pointer offset ${offset}`)
  //   }
  // }

  // /**
  //  * @param {[source: Uint8Array, offset: number]} input
  //  */
  // static tryFrom([source, offset]) {
  //   const tag = source[offset]
  //   if (tag === Tag.Pointer) {
  //     const [pointer, size] = Offset.decode(source, offset + 1)
  //     return { ok: new Pointer(Number(pointer)) }
  //   } else {
  //     return {
  //       error: {
  //         TypeError: new TypeError(
  //           `Expected pointer tag ${Tag.Pointer} instead got ${tag}`
  //         ),
  //       },
  //     }
  //   }
  // }
}

/**
 * @template {Type.Scalar} T
 * @implements {Type.Encoder<[offset: number, content: T]>}
 */
class Encoder {
  /**
   * @param {Map<string|number|bigint, Pointer>} memory
   * @param {Type.Encoder<T, Uint8Array>} codec
   */
  constructor(memory, codec, threshold = MIN_LENGTH_FOR_POINTER) {
    this.memory = memory
    this.codec = codec
    this.threshold = threshold
  }
  /**
   * @param {[offset: number, content: T]} source
   */
  *encode([offset, content]) {
    const { memory, codec: encoder, threshold } = this
    const key = refer(content).toString()
    const pointer = memory.get(key)

    // If we do have pointer for this source we encode a pointer
    if (pointer) {
      return yield* pointer.encode(offset)
    } else {
      const length = yield* encoder.encode(content)
      // If content is large enough to justify a pointer we make one.
      if (length > threshold) {
        memory.set(key, new Pointer(offset))
      }
      return length
    }
  }
}

/**
 * @template {Type.Scalar} T
 * @implements {Type.Decoder<T, Type.BufferReader>}
 */
class Decoder {
  /**
   * @param {Map<number, T>} memory
   * @param {Type.Decoder<T, Type.BufferReader>} codec
   */
  constructor(memory, codec) {
    this.memory = memory
    this.codec = codec
  }
  /**
   * @param {Type.BufferReader} buffer
   */
  *decode(buffer) {
    const { memory, codec } = this
    if (buffer.at(0) === Tag.Pointer.code) {
      const pointer = yield* Pointer.decode(buffer)
      const value = pointer.resolve(memory)
      if (value == null) {
        throw new RangeError(`Invalid pointer offset ${pointer.offset}`)
      } else {
        return value
      }
    } else {
      const offset = buffer.byteOffset
      const scalar = yield* codec.decode(buffer)
      this.memory.set(offset, scalar)
      return scalar
    }
  }
}
