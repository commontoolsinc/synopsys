import { Task } from 'synopsys'

/**
 * @type {import('entail').Suite}
 */
export const testQueue = {
  testTwoSyncTasks: (assert) =>
    Task.spawn(function* () {
      const queue = Task.queue()

      const a = queue.spawn(function* () {
        return 'a'
      })

      const b = queue.spawn(function* () {
        return 'b'
      })

      assert.equal(yield* b, 'b')
      assert.equal(yield* a, 'a')
    }),

  testTwoAsyncTasks: (assert) =>
    Task.spawn(function* () {
      const queue = Task.queue()
      /** @type {string[]} */
      const order = []

      const a = queue.spawn(function* () {
        yield* Task.sleep(10)
        order.push('a')
        return 'a'
      })

      const b = queue.spawn(function* () {
        yield* Task.sleep(2)
        order.push('b')
        return 'b'
      })

      assert.equal(yield* b, 'b')
      assert.equal(yield* a, 'a')
      assert.deepEqual(order, ['a', 'b'])
    }),

  'testSync&Async': (assert) =>
    Task.spawn(function* () {
      const queue = Task.queue()
      /** @type {string[]} */
      const order = []

      const a = queue.spawn(function* () {
        yield* Task.sleep(10)
        order.push('a')
        return 'a'
      })

      const b = queue.spawn(function* () {
        order.push('b')
        return 'b'
      })

      const c = queue.spawn(function* () {
        yield* Task.sleep(1)
        order.push('c')
        return 'c'
      })

      assert.equal(yield* c, 'c')
      assert.equal(yield* b, 'b')
      assert.equal(yield* a, 'a')

      assert.deepEqual(order, ['a', 'b', 'c'])
    }),
}
