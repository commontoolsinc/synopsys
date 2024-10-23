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

  /** @type {Promise<T>['then']} */
  then(onResolve, onReject) {
    return this.promise.then(onResolve, onReject)
  }
  /** @type {Promise<T>['catch']} */
  catch(onReject) {
    return this.promise.catch(onReject)
  }
  /** @type {Promise<T>['finally']} */
  finally(onFinally) {
    return this.promise.finally(onFinally)
  }
  get [Symbol.toStringTag]() {
    return 'PromiseController'
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
