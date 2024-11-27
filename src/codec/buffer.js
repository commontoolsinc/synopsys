import ArrayLike from './array-like.js'

/**
 * @extends {ArrayLike<number>}
 */
export class Buffer extends ArrayLike {
  /**
   * @param {Buffer} buffer
   * @param {number} [startOffset]
   * @param {number} [endOffset]
   */
  static slice(buffer, startOffset = 0, endOffset = buffer.byteLength) {
    const segments = []
    const start =
      startOffset < 0 ? buffer.byteLength - startOffset : startOffset
    const end = endOffset < 0 ? buffer.byteLength - endOffset : endOffset

    // If start at 0 offset and end is past buffer range it is effectively
    // as same buffer.
    if (start === 0 && end >= buffer.byteLength) {
      return buffer
    }

    // If range is not within the current buffer just create an empty slice.
    if (start > end || start > buffer.byteLength || end <= 0) {
      return new Buffer()
    }

    let byteLength = 0
    let offset = 0
    for (const segment of buffer.#segments) {
      const nextOffset = offset + segment.byteLength
      // Have not found a start yet
      if (byteLength === 0) {
        // If end offset is within the current segment we know start is also,
        // because it preceeds the end & we had not found start yet.
        // In such case we create a view with only single segment of bytes
        // in the range.
        if (end <= nextOffset) {
          const range = segment.subarray(start - offset, end - offset)
          segments.push(range)
          byteLength = range.byteLength
          break
        }
        // If start offeset falls with in current range (but not the end)
        // we save matching buffer slice and update byteLength.
        else if (start < nextOffset) {
          const range =
            start === offset ? segment : segment.subarray(start - offset)
          segments.push(range)
          byteLength = range.byteLength
        }
      }
      // Otherwise we already started collecting matching segments and are looking
      // for the end end of the slice. If it is with in the current range capture
      // the segment and create a view.
      else if (end <= nextOffset) {
        const range =
          end === nextOffset ? segment : segment.subarray(0, end - offset)
        segments.push(range)
        byteLength += range.byteLength
        break
      }
      // If end is past current range we just save the segment and continue.
      else {
        segments.push(segment)
        byteLength += segment.byteLength
      }

      offset = nextOffset
    }

    return new Buffer(segments, buffer.byteOffset + start, byteLength)
  }
  #byteLength = 0
  #byteOffset = 0
  /** @type {Uint8Array[]} */
  #segments
  /**
   * @param {Uint8Array[]} segments
   * @param {number} byteOffset
   * @param {number} byteLength
   */
  constructor(segments = [], byteOffset = 0, byteLength = 0) {
    super()
    this.#segments = segments
    this.#byteLength = byteLength
    this.#byteOffset = byteOffset
  }
  get byteLength() {
    return this.#byteLength
  }
  get length() {
    return this.#byteLength
  }
  get byteOffset() {
    return this.#byteOffset
  }

  *[Symbol.iterator]() {
    for (const part of this.#segments) {
      yield* part
    }
  }

  /**
   * @param {number} [start]
   * @param {number} [end]
   */
  slice(start, end) {
    return Buffer.slice(this, start, end)
  }

  /**
   * @param {number} [start]
   * @param {number} [end]
   */
  subarray(start, end) {
    return Buffer.slice(this, start, end)
  }

  /**
   * @param {Uint8Array} bytes
   * @returns
   */
  write(bytes) {
    this.#segments.push(bytes)
    this.#byteLength += bytes.byteLength

    return bytes.byteLength
  }

  /**
   * @param {Iterable<Uint8Array>} chunks
   */
  import(chunks) {
    let total = 0
    for (const chunk of chunks) {
      total += this.write(chunk)
    }
    return total
  }

  /**
   * @param {number} n
   */
  at(n) {
    if (n < this.#byteLength) {
      let offset = 0
      for (const segment of this.#segments) {
        if (n < offset + segment.byteLength) {
          return segment[n - offset]
        } else {
          offset += segment.byteLength
        }
      }
    }

    return undefined
  }

  /**
   *
   * @param {Uint8Array} target
   * @param {number} byteOffset
   */
  copyTo(target, byteOffset) {
    let offset = byteOffset
    for (const segment of this.#segments) {
      target.set(segment, offset)
      offset += segment.byteLength
    }

    return target
  }

  *segments() {
    yield* this.#segments
  }

  *export() {
    yield* this.segments()
  }

  toUint8Array() {
    return this.copyTo(new Uint8Array(this.byteLength), 0)
  }
}

export default Buffer
