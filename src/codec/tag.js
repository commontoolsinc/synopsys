import * as Error from './error.js'
import * as Type from './type.js'

/**
 * @template {string} Name
 * @template {number} Code
 */
class Tag {
  /**
   * @template {Record<string, number>} Table
   * @param {Table} table
   */
  static from(table) {
    return /** @type {{ [K in keyof Table & string]: Tag<K, Table[K]> }} */ (
      Object.fromEntries(
        Object.entries(table).map(([name, code]) => {
          return [name, new Tag(name, code)]
        })
      )
    )
  }
  /**
   * @param {Name} name
   * @param {Code} code
   */
  constructor(name, code) {
    this.name = name
    this.code = code
  }
  /**
   * @param {Type.BufferReader} buffer
   */
  *decode(buffer) {
    const { code, name } = this
    const byte = buffer.take() ?? (yield* Error.incomplete({ segment: name }))
    if (byte !== code) {
      return yield* Error.invalid({
        segment: name,
        expect: code,
        actual: byte,
        at: buffer.byteOffset,
      })
    }

    return byte
  }
}

export const {
  Raw,
  Reference,
  Null,
  Boolean,
  Integer,
  Float,
  Text,
  Pointer,
  Retract,
  Assert,
  Upsert,
  Transact,
} = Tag.from({
  // Just match the multicodec for the raw multihash
  Raw: 0x00,
  // ℹ️ We don't support CIDs just keeping a code open in case we do in the future.
  // CID: 0x01,

  // Match reference multicodec code
  Reference: 0x07,
  Null: 0x10,
  Boolean: 0x11,
  Integer: 0x12,
  Float: 0x13,
  Text: 0x14,

  Pointer: 0x05,

  Retract: 0xa0,
  Assert: 0xa1,
  Upsert: 0xa2,

  Transact: 0xa3,
})
