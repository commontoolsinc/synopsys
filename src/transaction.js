import * as Reference from './datum/reference.js'
import * as Type from './codec/type.js'
import { sha256 } from 'merkle-reference'
import { refer } from './datum/reference.js'
import { transform } from './replica/sync.js'
import * as LEB128 from './codec/LEB128.js'
import * as Scalar from './codec/scalar.js'
import * as Tag from './codec/tag.js'
import * as Error from './codec/error.js'
import { BufferReader, Pointer } from './codec/memory.js'

export class Writer {
  /** @type {{}|null} */
  #writer

  /**
   * @param {WritableStreamDefaultWriter<Uint8Array>} destination
   */
  constructor(destination) {
    this.destination = destination
    this.hasher = sha256.create()
    this.offset = 0

    this.#writer = null
  }

  get locked() {
    return this.#writer != null
  }
  /**
   * @param {Uint8Array} chunk
   */
  write(chunk) {
    this.offset += chunk.byteLength
    this.hasher.update(chunk)
    return this.destination.write(chunk)
  }

  /**
   * @template {{}} T
   * @param {{open: (input: Writer) => T}} Writer
   * @returns {T}
   */
  open(Writer) {
    if (this.#writer == null) {
      const writer = Writer.open(this)
      this.#writer = writer
      return writer
    } else {
      throw new Error(`Writer is already open`)
    }
  }
  /**
   *
   * @param {{}} writer
   */
  close(writer) {
    if (this.#writer === writer) {
      this.#writer = null
    } else {
      throw new Error(`Writer is not open`)
    }
  }
}

export class Packet {
  /** @type {Writer} */
  #writer
  /**
   * @param {WritableStreamDefaultWriter<Uint8Array>} destination
   */
  constructor(destination) {
    this.#writer = new Writer(destination)
  }

  /**
   * @param {Uint8Array} chunk
   */
  write(chunk) {
    if (this.#writer.locked) {
      throw new Error('Writer is locked')
    } else {
      return this.#writer.write(chunk)
    }
  }

  /**
   * @template {{}} T
   * @param {{open: (input: Writer) => T}} Writer
   */
  open(Writer) {
    return this.#writer.open(Writer)
  }

  frame() {
    return this.open(FrameWriter)
  }
}

/**
 * @typedef {object} Group
 * @property {(member: unknown) => unknown} join
 */

export class FrameWriter {
  /**
   * @param {Writer} writer
   */
  static open(writer) {
    return new FrameWriter(writer)
  }
  /**
   * @param {Writer} writer
   */
  constructor(writer) {
    /** @type {null|Writer} */
    this.writer = writer
    this.size = LEB128.Unsigned
    this.buffer = new Uint8Array(65536)
    this.length = 0
  }

  /**
   * @param {Uint8Array} chunk
   */
  write(chunk) {
    if (this.length + chunk.byteLength >= this.buffer.byteLength) {
      const buffer = new Uint8Array(this.buffer.byteLength * 4)
      buffer.set(this.buffer, 0)
      this.buffer = buffer
    }

    this.buffer.set(chunk, this.length)
    this.length += chunk.byteLength
  }
  async close() {
    if (this.writer) {
      const size = this.writer.write(this.size.toBytes(this.length))
      const frame = this.writer.write(this.buffer.subarray(0, this.length))
      this.writer.close(this)
      await Promise.all([size, frame])
    } else {
      throw new Error(`Writer is closed`)
    }
  }
}

export const VERSION = 1

export const POINTER_WORTHY = 5

export class ColumnEncoder {
  constructor() {
    this.encoder = new Encoder()
    this.deltaEncoder = new Delta()
    this.scalarEncoder = new ScalarEncoder()
  }
  /**
   *
   * @param {Type.Scalar} data
   */
  encode(data) {
    const payload = this.scalarEncoder.encode(data)
    if (payload.byteLength > POINTER_WORTHY) {
      const id = refer(payload).toString()
      if (this.index) this.encoder.write(payload)
    }
  }
}

export class DeltaEncoder {
  constructor() {
    this.count = new Leb128()
    this.last = 0
  }
  /**
   * @param {number} value
   */
  encode(value) {
    const payload = this.count.encode(value - this.last)
    this.last = value
    return payload
  }
  /**
   *
   * @param {Uint8Array} bytes
   * @param {number} offset
   */
  decode(bytes, offset = 0) {
    const [value, count] = this.count.decode(bytes, offset)
    this.last += Number(value)
    return [this.last, count]
  }
}

export const Instruction = {
  retract: 0,
  assert: 1,
  upsert: 2,
}

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

/**
 * @param {Type.Fact} fact
 * @param {object} state
 * @param {Map<string|number|bigint, Pointer>} state.index
 * @param {number} state.offset
 * @returns {Iterable<Uint8Array>}
 */
function* encodeFact([entity, attribute, value], { index, offset }) {
  {
    const id = entity.toString()
    const pointer = index.get(id)
    if (pointer) {
      offset += yield* pointer.encode(offset)
    } else {
      const pointer = new Pointer(offset)
      index.set(id, pointer)
      yield Reference.toBytes(/** @type {Type.Reference} */ (entity))
      offset += Reference.SIZE
    }
  }

  {
    const id =
      typeof attribute === 'object' ? refer(attribute).toString() : attribute
    const pointer = index.get(id)
    if (pointer) {
      offset += yield* pointer.encode(offset)
    } else {
      const pointer = new Pointer(offset)
      index.set(id, pointer)
      offset += yield* Scalar.encode(attribute)
    }
  }

  {
    const id =
      typeof attribute === 'object'
        ? refer(attribute).toString()
        : refer(value).toString()
    const pointer = index.get(id)
    if (pointer) {
      offset += yield* pointer.encode(offset)
    } else {
      const pointer = new Pointer(offset)
      index.set(id, pointer)
      offset += yield* Scalar.encode(attribute)
    }
  }
}

const Transact = new Uint8Array([Tag.Transact.code])
const Retract = new Uint8Array([Tag.Retract.code])
const Assert = new Uint8Array([Tag.Assert.code])
const Upsert = new Uint8Array([Tag.Upsert.code])

/**
 * @param  {Iterable<Uint8Array>} chunks
 */
function* write(chunks) {
  let offset = 0
  for (const chunk of chunks) {
    yield chunk
    offset += chunk.byteLength
  }
  return offset
}

/**
 * @param {Type.Transaction} changes
 * @param {object} [state]
 * @param {Map<string|number|bigint, Pointer>} [state.index]
 * @param {number} [state.offset]
 *
 * @returns {Iterable<Uint8Array>}
 */
export const encodeTransaction = function* (
  changes,
  { index = new Map(), offset = 0 } = {}
) {
  const asserted = []
  const upserted = []

  offset += yield* write([Transact])
  let start = offset

  // Then iterate over the changes and write retracts and collect asserts
  // and upserts to write them after all retracts.
  for (const change of changes) {
    if (change.Retract) {
      // If it is a first retraction start a corresponding frame
      if (offset === start) {
        offset += yield* write([Retract])
      }

      offset += yield* write(encodeFact(change.Retract, { offset, index }))
    }

    if (change.Assert) {
      asserted.push(change.Assert)
    }

    if (change.Upsert) {
      upserted.push(change.Upsert)
    }
  }

  // Write the assert group if it is not empty
  if (asserted.length > 0) {
    offset += yield* write([Assert])

    for (const fact of asserted) {
      offset += yield* write(encodeFact(fact, { offset, index }))
    }
  }

  // Write the upsert group if it is not empty
  if (upserted.length > 0) {
    offset += yield* frame([Upsert])

    for (const fact of upserted) {
      offset += yield* frame(encodeFact(fact, { offset, index }))
    }
  }

  return offset
}

export const HEADER = new Uint8Array([VERSION])

/**
 * @param {Iterable<Type.Transaction>} history
 * @returns {Iterable<Uint8Array>}
 */
export const encodeHistory = function* (history) {
  yield HEADER

  for (const transaction of history) {
    yield* encodeTransaction(transaction)
  }
}

/**
 * Encodes transaction log into a byte stream.
 *
 * @param {ReadableStream<Type.Transaction>} source
 * @returns {ReadableStream<Uint8Array>}
 */
export const encode = (source) =>
  transform(source, {
    *init() {
      return [null, [HEADER]]
    },
    *step(_, transaction) {
      return [null, encodeTransaction(transaction)]
    },
    *close() {
      return []
    },
  })

const EMPTY = new Uint8Array(0)

/**
 * @param {Uint8Array} buffer
 * @param {Uint8Array} chunk
 */
const append = (buffer, chunk) => {
  if (buffer.byteLength === 0) {
    return chunk
  }

  if (chunk.byteLength === 0) {
    return buffer
  }

  const content = new Uint8Array(buffer.length + chunk.length)
  content.set(buffer, 0)
  content.set(chunk, buffer.byteLength)

  return content
}

/**
 * @typedef {Type.Variant<{
 *   New: {}
 *   Version: {}
 *   Transaction: {}
 *   Retract: { buffer: Uint8Array }
 *   Assert: { buffer: Uint8Array }
 *   Upsert: { buffer: Uint8Array }
 * }>} DecodeState
 */
/**
 * Decodes encoded transaction log into a stream of transactions.
 *
 * @param {ReadableStream<Uint8Array>} source
 */
export const decode = (source) =>
  transform(source, {
    *init() {
      return [{ New: {} }, []]
    },
    /**
     *
     * @param {DecodeState} state
     * @param {Uint8Array} chunk
     * @returns
     */
    *step(state, chunk) {
      const buffer = new BufferReader(chunk)
      if (state.New) {
        return readVersion(buffer)
      }

      if (state.Version) {
        return readTransaction(chunk)
      }

      if (state.Transaction) {
        return readInstruction(chunk) ?? readTransaction(chunk) ?? wait(chunk)
      }

      if (state.Retract) {
        const buffer = append(state.Retract.buffer, chunk)
        return (
          readInstruction(buffer) ??
          readRetract(buffer) ??
          readTransaction(buffer) ??
          wait(buffer)
        )
      }

      if (state.Assert) {
        const buffer = append(state.Assert.buffer, chunk)
        return (
          readInstruction(buffer) ??
          readAssert(buffer) ??
          readTransaction(buffer) ??
          wait(buffer)
        )
      }

      if (state.Upsert) {
        const buffer = append(state.Upsert.buffer, chunk)
        return (
          readInstruction(buffer) ??
          readUpsert(buffer) ??
          readTransaction(buffer) ??
          wait(buffer)
        )
      }
    },
    *close(state) {
      throw new Error('Stream was interrupted')
    },
  })

/**
 * @param {Type.BufferReader} buffer
 */
function* readVersion(buffer) {
  const byte =
    buffer.take() ?? (yield* Error.incomplete({ segment: 'Version' }))

  if (byte !== VERSION) {
    yield* Error.invalid({
      segment: 'Version',
      expect: VERSION,
      actual: byte,
      at: buffer.byteOffset,
    })
  }

  if (buffer.length === 0) {
    return [{ New: {} }, []]
  } else if (buffer[0] === VERSION) {
    if (buffer.length === 1) {
      return [{ Version: {} }, []]
    } else {
      return readTransaction(buffer.subarray(1))
    }
  } else {
    return readError(`Unsupported transaction log version`)
  }
}

/**
 *
 * @param {Uint8Array} buffer
 * @returns
 */
function readTransaction(buffer) {
  if (buffer.length === 0) {
    return [{ Transaction: {} }, []]
  } else if (buffer[0] === Tag.Transact) {
    if (buffer.length === 1) {
      return [{ Transaction: {} }, []]
    } else {
      const payload = buffer.subarray(1)
      return (
        tryInstruction(payload) ??
        tryTransaction(payload) ??
        readError(`Expected instruction tag after Transact tag`)
      )
    }
  } else {
    return readError(
      `Invalid transaction log format, expected Transact tag after version tag`
    )
  }
}

/**
 * @param {string} message
 */
function readError(message) {
  throw new RangeError(message)
}
/**
 *
 * @param {Uint8Array} buffer
 * @returns
 */
function tryInstruction(buffer) {
  if (buffer.length === 0) {
    return [{ Transaction: {} }, []]
  }

  const payload = buffer.subarray(1)

  switch (buffer[0]) {
    case Tag.Retract:
      return tryRetract(payload) ?? [{ Retract: { buffer: payload } }, []]
    case Tag.Assert:
      return tryAssert(payload) ?? [{ Assert: { buffer: payload } }, []]
    case Tag.Upsert:
      return tryUpsert(payload) ?? [{ Upsert: { buffer: payload } }, []]
    default:
      return null
  }
}

/**
 *
 * @param {Uint8Array} buffer
 */
function tryRetract(buffer) {
  if (buffer.length === 0) {
    return [{ Retract: { buffer: EMPTY } }, []]
  } else {
    const payload = buffer.subarray(1)
    switch (buffer[0]) {
      case Tag.Retract:
        return tryRetract(payload)
      case Tag.Assert:
        return tryAssert(payload)
      case Tag.Upsert:
        return tryUpsert(payload)
      case Tag.Transact:
        return tryTransaction(payload)
      default:
        return tryFact(payload) ?? [{ Retract: { buffer: payload } }, []]
    }
  }
}

/**
 *
 * @param {Uint8Array} buffer
 */
function tryFact(buffer) {
  if (buffer.length === 0) {
    return null
  } else {
    Scalar.decode(buffer)
  }
}
