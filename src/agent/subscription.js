import * as Type from './type.js'
import { Task } from 'datalogia'

/**
 * @template {Type.Selector} [Select=Type.Selector]
 * @typedef {object} Options
 * @property {Type.Query<Select>} query
 * @property {ReadableStream<Type.Selection<Select>[]>} source
 */

/**
 * Open a subscription for the given query source.
 *
 * @template {Type.Selector} [Select=Type.Selector]
 * @param {Options<Select>} options
 */
export const open = function* ({ query, source }) {
  return new SubscriptionStream(undefined, undefined, { query, source })
}

// const read = new ReadableStream()

/**
 * @template {Type.Selector} [Select=Type.Selector]
 * @implements {Type.Subscription<Select>}
 * @extends {ReadableStream<Type.Selection<Select>[]>}
 */
class SubscriptionStream extends ReadableStream {
  /**
   * @param {undefined} _source
   * @param {undefined} _strategy
   * @param {Options<Select>} options
   */
  constructor(_source, _strategy, { query, source }) {
    super({
      pull: async (controller) => {
        try {
          const next = await this.reader.read()
          if (next.done) {
            controller.close()
          } else {
            controller.enqueue(next.value)
          }
        } catch (error) {
          controller.error(error)
        }
      },
      cancel: () => {
        this.reader.cancel()
      },
    })
    this.reader = source.getReader()
    this.query = query
  }
  *poll() {
    const reader = this.getReader()
    const next = yield* Task.wait(reader.read())
    reader.releaseLock()
    if (!next.done) {
      return next.value
    } else {
      throw new Error(`Subscription is closed`)
    }
  }
}
