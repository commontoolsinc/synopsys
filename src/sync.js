import * as Type from './replica/type.js'
import { transform } from './replica/sync.js'
import * as DAG from './replica/dag.js'
import * as JSON from '@ipld/dag-json'
import { Task } from 'datalogia'
import { refer } from './datum/reference.js'
import { error } from 'console'

export const contentType = 'application/okra-sync'

class Synchronizer {
  /**
   * @param {Type.Store} source
   */
  constructor(source) {
    this.source = source
    /** @type {TransformStream[]} */
    this.queue = []
    /** @type {Type.Variant<{idle:{}, busy:{}}>}  */
    this.status = { idle: {} }
  }
  /**
   *
   * @param {TransformStream} channel
   */
  *enqueue({ readable, writable }) {
    this.queue.push({ readable, writable })
    yield* this.resume()
  }
  *resume() {
    if (this.status.idle) {
      this.status = { busy: {} }
      yield* Task.sleep(0)
      while (this.queue.length > 0) {
        const { readable, writable } = this.queue[0]
        this.queue.shift()
        yield* this.source.write(function* (writer) {
          const task = interpret(
            writer,
            readable.getReader(),
            writable.getWriter()
          )
          return yield* Task.result(task)
        })
      }
      this.status = { idle: {} }
    }
  }
}

/**
 * @typedef {Synchronizer} Service
 */

/**
 * @param {Type.Store} source
 */
export function* open(source) {
  return new Synchronizer(source)
}

/**
 * @param {Synchronizer} self
 */
export function synchronize(self) {
  const { readable: input, writable } = new TransformStream()
  const { readable, writable: output } = new TransformStream()

  Task.perform(self.enqueue({ readable: input, writable: output }))

  return { writable, readable }
}

/**
 * @typedef {Type.Variant<{
 *   getRoot: { cause: Type.Reference },
 *   getNode: { cause: Type.Reference, key: Uint8Array, level: number },
 *   getChildren: { cause: Type.Reference, key: Uint8Array, level: number },
 *   integrate: { cause: Type.Reference, changes: Type.Change[] },
 * }>} Command
 *
 * @typedef {object} Outcome
 * @property {Type.Result} result
 * @property {Type.Reference} cause
 */

/**
 *
 * @param {Uint8Array} bytes
 */
function* toCommand(bytes) {
  const command = yield* DAG.decode(JSON, bytes)
  return /** @type {Command} */ (command)
}

/**
 *
 * @param {Type.PullSource & Type.PushSource} store
 * @param {ReadableStreamDefaultReader<Uint8Array>} input
 * @param {WritableStreamDefaultWriter<Uint8Array>} output
 */
export function* interpret(store, input, output) {
  while (true) {
    const next = yield* Task.wait(input.read())
    if (next.done) {
      return yield* Task.wait(output.close())
    } else {
      const command = yield* toCommand(next.value)
      const cause = refer(command)
      const result = yield* Task.result(perform(store, command))
      const response = result.ok
        ? { result, cause }
        : {
            cause,
            result: {
              error: {
                message: result.error?.message ?? 'Unknown error',
                ...(result.error?.stack ? { stack: result.error.stack } : {}),
              },
            },
          }
      const payload = yield* DAG.encode(JSON, response)
      yield* Task.wait(output.write(payload))
    }
  }
}

/**
 * @param {Type.PullSource & Type.PushSource} store
 * @param {Command} command
 */

function* perform(store, command) {
  if (command.getRoot) {
    return yield* store.getRoot()
  } else if (command.getNode) {
    return yield* store.getNode(command.getNode.level, command.getNode.key)
  } else if (command.getChildren) {
    return yield* store.getChildren(
      command.getChildren.level,
      command.getChildren.key
    )
  } else if (command.integrate) {
    return yield* store.integrate(command.integrate.changes)
  } else {
    throw new Error('Unknown command')
  }
}
