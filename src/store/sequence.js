import * as Type from './type.js'
import { Task } from 'datalogia'

export const end = () => END

/**
 * @implements {Type.IterationFinished}
 */
export class IterationFinished extends RangeError {
  name = /** @type {const} */ ('IterationFinished')
  constructor() {
    super('Iteration has finished')
  }
}

const END = { error: new IterationFinished() }

/**
 * @template T, U
 * @param {Type.Sequence<T>} source
 * @param {(input: T) => U} f
 * @returns {Type.Sequence<U>}
 */
export const map = (source, f) => new MappedSequence(source, f)

/**
 * @template T, U
 * @implements {Type.Sequence<U>}
 */
class MappedSequence {
  /**
   * @param {Type.Sequence<T>} source
   * @param {(input: T) => U} f
   */
  constructor(source, f) {
    this.source = source
    this.f = f
  }
  *next() {
    const { source } = this
    while (true) {
      const next = yield* source.next()
      if (next.error) {
        return next
      } else {
        return { ok: this.f(next.ok) }
      }
    }
  }
}

/**
 * @template T
 * @param {Type.Sequence<T>} source
 * @returns {Type.AwaitIterable<T>}
 */
export const toIterator = (source) => new ToAwaitIterator(source)

/**
 * @template T
 * @implements {Type.AwaitIterable<T>}
 */
class ToAwaitIterator {
  /**
   *
   * @param {Type.Sequence<T>} source
   */
  constructor(source) {
    this.source = source
  }
  /**
   *
   * @returns {Type.Awaitable<IteratorResult<T>>}
   */
  next() {
    const { source } = this

    let output = null
    const result = Task.spawn(function* () {
      const result = yield* source.next()
      output = result.error
        ? { done: true, value: undefined }
        : { done: false, value: result.ok }

      return output
    })

    return output ?? /** @type {Promise<IteratorResult<T>>} */ (result)
  }
  [Symbol.iterator]() {
    return this
  }
  [Symbol.asyncIterator]() {
    return this
  }
}
