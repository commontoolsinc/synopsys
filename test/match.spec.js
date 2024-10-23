import * as DB from 'datalogia'
import { Task, Agent, refer, variable } from 'synopsys'
import * as Memory from 'synopsys/store/memory'

/**
 * @type {import('entail').Suite}
 */
export const testQuery = {
  query: (assert) =>
    Task.spawn(function* () {
      const store = yield* Memory.open()
      const agent = yield* Agent.open({ local: { store } })

      const stuff = refer({ collection: 'stuff' })
      const member = refer({ member: 'email', of: stuff })

      yield* DB.transact(agent, [
        { Assert: [stuff, 'member', member] },
        { Assert: [member, 'message', "You've got an email!"] },
      ])

      const collection = variable()
      const item = variable()
      const key = variable()
      const value = variable()

      const subscription = yield* agent.subscribe({
        select: {
          collection,
          item: [
            {
              item,
              key,
              value,
            },
          ],
        },
        where: [
          { Case: [collection, 'member', item] },
          { Case: [item, key, value] },
          { Match: [{ text: value, pattern: '*email*' }, 'text/like'] },
        ],
      })

      const initial = yield* subscription.poll()

      assert.deepEqual(initial, [
        {
          collection: stuff,
          item: [
            {
              item: member,
              key: 'message',
              value: "You've got an email!",
            },
          ],
        },
      ])

      yield* DB.transact(agent, [
        { Retract: [member, 'message', "You've got an email!"] },
        { Assert: [member, 'message', 'You have an email!'] },
      ])

      const updated = yield* subscription.poll()

      assert.deepEqual(updated, [
        {
          collection: stuff,
          item: [
            {
              item: member,
              key: 'message',
              value: 'You have an email!',
            },
          ],
        },
      ])
    }),
}
