import { transform } from './sync.js'
import * as DAG from './dag.js'
import * as JSON from '@ipld/dag-json'

/**
 * @param {ReadableStream<Uint8Array>} source
 */
export const fromEventSource = (source) =>
  transform(source, {
    *init() {
      return [, []]
    },
    *step(_, chunk) {
      const message = yield* toEventSourceMessage(chunk)
      const dag = yield* DAG.decode(JSON, message)
      return [, [dag]]
    },
    *close() {
      return []
    },
  })

const LINE_BREAK = '\n'.charCodeAt(0)
const COLON = ':'.charCodeAt(0)

/**
 * @param {Uint8Array} bytes
 */
function* toEventSourceMessage(bytes) {
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

  throw new RangeError('Invalid EventSource message')
}
