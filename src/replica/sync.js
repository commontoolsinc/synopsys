import * as Task from '../task.js'
import * as Type from './type.js'

/**
 * Represents CSP style channel similar to [one in rust]
 * (https://doc.rust-lang.org/std/sync/mpsc/fn.channel.html) or
 * clojure's [core.async](https://clojure.org/guides/async_walkthrough) but
 * strictly with a buffer of 0 meaning all reads are blocked on corresponding
 * writes.
 *
 * @template T
 * @template {Error} Abort
 * @implements {Type.Channel<T, Abort>}
 * @extends {Promise<T>}
 */
class Channel {
  /** @type {(value:T) => void} */
  // @ts-expect-error - set in the constructor
  #write
  /** @type {(error?:Error) => void} */
  // @ts-expect-error - set in the constructor
  #cancel
  #promise
  constructor() {
    this.#promise = new Promise((write, cancel) => {
      this.#write = write
      this.#cancel = cancel
    })
  }

  /**
   * @param {T} value
   */
  write(value) {
    this.#write(value)
    this.#promise = new Promise((write, cancel) => {
      this.#write = write
      this.#cancel = cancel
    })
  }

  /**
   * @returns {Task.Invocation<T>}
   */
  read() {
    return Task.perform(Task.wait(this.#promise))
  }

  /**
   * @param {Abort} [error]
   */
  cancel(error) {
    this.#cancel(error)
  }
}

export const channel = () => new Channel()

/**
 * @template In, Out, State
 * @typedef {object} Transformer
 * @property {() => Task.Task<[State, Out[]], Error>} init
 * @property {(state: State, input: In) => Task.Task<[State, Out[]], Error>} step
 * @property {(state: State) => Task.Task<Out[], Error>} close
 */

/**
 * @template In, Out, State
 * @param {ReadableStream<In>} source
 * @param {Transformer<In, Out, State>} operator
 */
export const transform = (source, operator) => {
  /** @type {State} */
  let state
  /** @type {TransformStream<In, Out>} */
  const stream = new TransformStream({
    async start(controller) {
      const [init, output] = await Task.perform(operator.init())
      state = init
      for (const out of output) {
        controller.enqueue(out)
      }
    },
    async transform(chunk, controller) {
      const [next, output] = await Task.perform(operator.step(state, chunk))
      state = next
      for (const out of output) {
        controller.enqueue(out)
      }
    },
    async flush(controller) {
      const output = await Task.perform(operator.close(state))
      for (const out of output) {
        controller.enqueue(out)
      }
    },
  })

  return source.pipeThrough(stream)
}

/**
 * @template T
 * @param {ReadableStream<T>} source
 * @returns {Type.BroadcastStream<T>}
 */
export const broadcast = (source) => new BroadcastStream(source)

/**
 * @template T
 * @implements {Type.BroadcastStream<T>}
 * @implements {UnderlyingSink<T>}
 */
export class BroadcastStream {
  // #abort
  #closed
  #ports
  #source
  #task
  /** @type {T|undefined} */
  #last
  /**
   * @param {ReadableStream<T>} source
   * @param {Set<ReadableStreamDefaultController<T>>} [ports]
   */
  constructor(source, ports = new Set()) {
    this.#source = source.getReader()
    this.#closed = channel()
    this.#ports = ports
    /** @type {Promise<undefined>} */
    this.closed = this.#closed.read()
    this.aborted = false
    this.#task = Task.perform(BroadcastStream.poll(this))
  }

  /**
   * Publishes chunk to all connected ports.
   *
   * @param {T} chunk
   */
  write(chunk) {
    this.#last = chunk
    for (const port of this.#ports) {
      port.enqueue(chunk)
    }
  }
  /**
   * Closes all connected ports.
   */
  close() {
    for (const port of this.#ports) {
      port.close()
    }
    this.#ports.clear()
    this.#closed.write(undefined)
  }
  /**
   * @param {unknown} [reason]
   */
  abort(reason) {
    for (const port of this.#ports) {
      port.error(reason)
    }
    this.#ports.clear()
    this.#source.cancel(reason)
    this.#closed.write(undefined)
  }

  /**
   * @param {ReadableStreamDefaultController<T>} port
   */
  connect(port) {
    this.#ports.add(port)
    if (this.#last !== undefined) {
      port.enqueue(this.#last)
    }
  }
  /**
   * @param {ReadableStreamDefaultController<T>} port
   */
  disconnect(port) {
    this.#ports.delete(port)
    // If last port was disconnected we abort this stream.
    if (this.#ports.size === 0) {
      this.abort()
    }
  }

  /**
   * @template T
   * @param {BroadcastStream<T>} broadcast
   */
  static *poll(broadcast) {
    try {
      // Forward all chunks from the underlying source to all the connected
      // ports.
      while (true) {
        const { done, value } = yield* Task.wait(broadcast.#source.read())
        if (done) {
          break
        }
        broadcast.write(value)
      }
      // When done close the broadcast channel and all connected ports.
      broadcast.close()
    } catch (reason) {
      broadcast.abort(reason)
    }
  }

  fork() {
    /** @type {ReadableStreamDefaultController<T>} */
    let port
    return new ReadableStream({
      start: (controller) => {
        port = controller
        this.connect(port)
      },
      cancel: () => {
        this.disconnect(port)
      },
    })
  }
}
