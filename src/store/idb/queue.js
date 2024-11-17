import { Task } from 'datalogia'

export const create = () => new Queue()

export { create as new }

class Queue {
  constructor() {
    /** @type {Task.Invocation<void, Error>[]} */
    this.queue = []
  }

  /**
   * @template T
   * @param {() => Task.Task<T, Error>} work
   * @returns {Task.Task<T, Error>}
   */
  spawn(work) {
    const { queue } = this

    return Task.spawn(function* () {
      // Create an invocation that will be suspended until we're finished
      // work.
      const wait = Task.perform(Task.suspend())
      // Get a last invocation from our queue.
      const last = queue.pop()
      try {
        // Enqueue this invocation
        queue.push(wait)
        // If queue contained some invocation we wait for it
        // to be aborted.
        if (last != null) {
          yield* Task.result(last)
        }

        // Then we perform our work
        return yield* work()
      } finally {
        wait.abort(Task.RESUME)
      }
    })
  }

  // /**
  //  * @template T
  //  * @param {() => Task.Task<T, Error>} work
  //  * @returns {Task.Task<T, Error>}
  //  */
  // enqueue(work) {
  //   const pending = this.work
  //   const queued = Task.spawn(function* () {
  //     yield* Task.result(pending)
  //     const result = yield* work()
  //     return result
  //   })
  //   this.work = queued

  //   return queued
  // }
}
