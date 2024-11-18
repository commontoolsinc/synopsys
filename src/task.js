import * as Task from 'datalogia/task'
export * from 'datalogia/task'

export const queue = () => new Queue()

class Queue {
  constructor() {
    /** @type {Task.Invocation<void, Error>[]} */
    this.queue = []
  }

  /**
   * @template T
   * @template {Error} X
   * @param {() => Task.Task<T, X>} work
   * @returns {Task.Task<T, X>}
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
}
