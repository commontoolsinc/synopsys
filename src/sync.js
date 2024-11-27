import { Task } from 'datalogia'

import * as Codec from './codec.js'

export const contentType = 'application/synopsys-sync'

class Synchronizer {
  /**
   * @param {object} source
   * @param {import('node:fs/promises').FileHandle} source.file
   * @param {bigint} source.offset
   */
  constructor({ file, offset }) {
    this.file = file
    this.offset = offset
    const { readable, writable } = new TransformStream()
    this.readable = readable
    this.writer = writable.getWriter()
    /** @type {Set<WritableStreamDefaultWriter<Uint8Array>>} */
    this.consumers = new Set()

    this.poll()
  }

  async poll() {
    for await (const transaction of this.readable) {
      const chunk = Codec.encodeTransaction(transaction)
      const { bytesWritten } = await this.file.write(chunk)
      this.offset += BigInt(bytesWritten)

      for (const consumer of this.consumers) {
        consumer.write(chunk)
      }
    }
  }

  /**
   *
   * @param {ReadableStream<Uint8Array>} stream
   */
  async addTransactor(stream) {
    for await (const transaction of Codec.decode(stream)) {
      this.writer.write(transaction)
    }
  }

  /**
   * @param {WritableStream<Uint8Array>} writable
   * @param {object} options
   * @param {number} [options.offset]
   */
  async pipeTo(writable, { offset = 0 } = {}) {
    const writer = writable.getWriter()
    while (offset < this.offset) {
      for await (const chunk of this.file.createReadStream({
        start: offset,
        autoClose: false,
      })) {
        writer.write(chunk)
        offset += chunk.length
      }
    }
    this.consumers.add(writer)

    await writer.closed.catch(() => {})
    this.consumers.delete(writer)
  }
}

/**
 * @typedef {Synchronizer} Service
 */

/**
 * @param {object} source
 * @param {import('node:fs/promises').FileHandle} source.file
 */
export function* open({ file }) {
  const { size } = yield* Task.wait(file.stat({ bigint: true }))
  return new Synchronizer({ file, offset: size })
}

/**
 *
 * @param {Synchronizer} self
 * @param {object} options
 * @param {number} options.offset
 */
export function* pull(self, options) {
  const { readable, writable } = new TransformStream()
  self.pipeTo(writable, options)
  return readable
}

/**
 *
 * @param {Synchronizer} self
 * @param {ReadableStream<Uint8Array>} stream
 */
export function* push(self, stream) {
  return yield* Task.fork(Task.wait(self.addTransactor(stream)))
}
