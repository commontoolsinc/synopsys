import { transform } from './sync.js'
import * as DAG from './dag.js'
import * as JSON from '@ipld/dag-json'
import * as Type from './type.js'
import { of as refer } from '../datum/reference.js'
import * as UTF8 from '../utf8.js'

/**
 * @param {ReadableStream<Type.Selection<Type.Selector>[]>} source
 */
export const toEventSource = (source) =>
  transform(source, {
    *init() {
      return [, []]
    },
    *step(_, selection) {
      const bytes = yield* toEventSourceMessage(selection)
      return [, [bytes]]
    },
    ///* c8 ignore next 2 */ We don't really end subscriptions consumers cancel
    *close() {
      return []
    },
  })

/**
 * @param {ReadableStream<Uint8Array>} source
 */
export const fromEventSource = (source) =>
  transform(source, {
    *init() {
      return [, []]
    },
    *step(_, chunk) {
      const message = yield* fromEventSourceMessage(chunk)

      const selection = /** @type {Type.Selection<Type.Selector>[]} */ (
        yield* DAG.decode(JSON, message)
      )
      return [, [selection]]
    },
    ///* c8 ignore next 2 */ We don't really end subscriptions consumers cancel
    *close() {
      return []
    },
  })

const LINE_BREAK = '\n'.charCodeAt(0)
const COLON = ':'.charCodeAt(0)

/**
 * @param {Uint8Array} bytes
 */
function* fromEventSourceMessage(bytes) {
  let breaks = 0
  for (const [offset, byte] of bytes.entries()) {
    if (breaks < 2) {
      if (byte === LINE_BREAK) {
        breaks++
      }
    }

    if (byte === COLON && breaks === 2) {
      return bytes.slice(offset + 1)
    }
  }
  ///* c8 ignore next */  Don't have test to cover non event source response
  throw new RangeError('Invalid EventSource message')
}

/**
 * Encodes result of the query as event source message.
 *
 * @param {Type.Selection<Type.Selector>[]} selection
 */
export function* toEventSourceMessage(selection) {
  const id = refer(selection).toString()
  const body = `id:${id}\nevent:change\ndata:${JSON.stringify(selection)}\n\n`
  return UTF8.toUTF8(body)
}
