import * as DB from 'datalogia'
import { Task, Replica, refer, $ } from 'synopsys'
import * as Store from 'synopsys/store/memory'
import * as Blobs from 'synopsys/blob/memory'
import * as Service from 'synopsys/service'
import * as Subscription from './subscription.js'

const counter = refer({ counter: {} })

/**
 * @type {import('entail').Suite}
 */
export const testRemote = {
  transaction: {
    basic: (assert) =>
      Task.spawn(function* () {
        const store = yield* Store.open()
        const blobs = yield* Blobs.open()
        const service = yield* Service.open({ store, blobs })

        const remote = yield* Replica.open({
          remote: {
            url: new URL('http://localhost:8080'),
            fetch: service.fetch,
          },
        })

        const commit = yield* remote.transact([
          { Assert: [counter, 'count', 1] },
        ])

        assert.notEqual(commit.before.id, commit.after.id)

        const selection = yield* DB.query(service.source, {
          select: { count: $.count },
          where: [{ Case: [counter, 'count', $.count] }],
        })

        assert.deepEqual(selection, [{ count: 1 }])
      }),

    'invalid transaction': (assert) =>
      Task.spawn(function* () {
        const store = yield* Store.open()
        const blobs = yield* Blobs.open()
        const service = yield* Service.open({ store, blobs })

        const remote = yield* Replica.open({
          remote: {
            url: new URL('http://localhost:8080'),
            fetch: service.fetch,
          },
        })

        const result = yield* Task.result(
          remote.transact(
            // @ts-expect-error - invalid transaction
            { Assert: null }
          )
        )

        assert.ok(result.error, 'errors')
      }),
  },

  subscription: Subscription.testSubscription({
    connect: () =>
      Task.spawn(function* () {
        const store = yield* Store.open()
        const blobs = yield* Blobs.open()
        const service = yield* Service.open({ store, blobs })
        const replica = yield* Replica.open({
          remote: {
            url: new URL('http://localhost:8080'),
            fetch: service.fetch,
          },
        })
        return replica
      }),
  }),
}
