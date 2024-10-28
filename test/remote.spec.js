import * as DB from 'datalogia'
import { Task, Agent, refer, $ } from 'synopsys'
import * as Memory from 'synopsys/store/memory'
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
        const store = yield* Memory.open()
        const service = yield* Service.open({ store })

        const remote = yield* Agent.open({
          remote: {
            url: new URL('http://localhost:8080'),
            fetch: service.fetch,
          },
        })
        const init = service.revision

        const commit = yield* remote.transact([
          { Assert: [counter, 'count', 1] },
        ])

        assert.deepEqual(commit.before.id, init.id)

        const selection = yield* DB.query(store, {
          select: { count: $.count },
          where: [{ Case: [counter, 'count', $.count] }],
        })

        assert.deepEqual(selection, [{ count: 1 }])
      }),

    'invalid transaction': (assert) =>
      Task.spawn(function* () {
        const store = yield* Memory.open()
        const service = yield* Service.open({ store })

        const remote = yield* Agent.open({
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
        const store = yield* Memory.open()
        const service = yield* Service.open({ store })
        const agent = yield* Agent.open({
          remote: {
            url: new URL('http://localhost:8080'),
            fetch: service.fetch,
          },
        })
        return agent
      }),
  }),
}
