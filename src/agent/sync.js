import * as Task from 'datalogia/task'
import * as Type from './type.js'

/**
 * @template T
 * @implements {Type.SignalController<T>}
 * @extends {Promise<T>}
 */
class PromiseController {
  /** @type {(value:T) => void} */
  // @ts-expect-error - set in the constructor
  #resolve
  /** @type {(error:Error) => void} */
  // @ts-expect-error - set in the constructor
  #reject
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.#resolve = resolve
      this.#reject = reject
    })
  }

  /**
   * @param {T} value
   */
  send(value) {
    this.#resolve(value)
  }
  /**
   * @param {Error} error
   */
  abort(error) {
    this.#reject(error)
  }
}

export const promise = () => new PromiseController()

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
 */
export const broadcast = (source) => BroadcastStream.from(source)

/**
 * @template T
 * @implements {UnderlyingSink<T>}
 */
export class BroadcastStream {
  /**
   * @template T
   * @param {ReadableStream<T>} source
   */
  static from(source) {
    const broadcast = new BroadcastStream()
    broadcast.pipeInto(source)
    // source
    //   .pipeTo(broadcast.writable, {
    //     signal: broadcast.signal,
    //   })
    //   .then(
    //     () => {},
    //     (error) => {}
    //   )
    return broadcast
  }
  /**
   * @param {T} chunk
   */
  write(chunk) {
    for (const channel of this.channels) {
      channel.enqueue(chunk)
    }
  }
  close() {
    for (const channel of this.channels) {
      channel.close()
    }
  }
  /**
   * @param {unknown} [reason]
   */
  abort(reason) {
    for (const channel of this.channels) {
      channel.error(reason)
    }
  }

  /**
   * @param {ReadableStreamDefaultController<T>} channel
   */
  async cancel(channel) {
    this.channels.delete(channel)
    if (this.channels.size === 0) {
      this.#controller.abort()
    }
  }

  #controller
  #closed
  /**
   * @param {Set<ReadableStreamDefaultController<T>>} channels
   */
  constructor(channels = new Set()) {
    this.#closed = promise()
    this.#controller = new AbortController()
    this.writable = new WritableStream(this)
    this.channels = channels

    this.signal.addEventListener(
      'abort',
      () => this.abort(this.signal.reason),
      { once: true }
    )
  }
  get closed() {
    return this.#closed.promise
  }
  get signal() {
    return this.#controller.signal
  }
  /**
   *
   * @param {ReadableStream<T>} source
   */
  async pipeInto(source) {
    const reader = source.getReader()
    this.signal.addEventListener('abort', () => reader.cancel(), { once: true })
    try {
      while (!this.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        this.write(value)
      }
    } finally {
      await reader.cancel()
      this.#closed.send(undefined)
    }
  }
  fork() {
    const { channels } = this
    /** @type {ReadableStreamDefaultController<T>} */
    let channel
    return new ReadableStream({
      start: (controller) => {
        channel = controller
        channels.add(channel)
      },
      cancel: () => {
        this.cancel(channel)
      },
    })
  }
}
