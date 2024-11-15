import { Task, Replica, refer, variable } from 'synopsys'
import * as Memory from 'synopsys/store/memory'

/**
 * @type {import('entail').Suite}
 */
export const testMatch = {
  'text/like': (assert) =>
    Task.spawn(function* () {
      const source = yield* Memory.open()
      const replica = yield* Replica.open({ local: { source } })

      const stuff = refer({ collection: 'stuff' })
      const member = refer({ member: 'email', of: stuff })

      yield* Replica.transact(replica, [
        { Assert: [stuff, 'member', member] },
        { Assert: [member, 'message', "You've got an email!"] },
      ])

      const collection = variable()
      const item = variable()
      const key = variable()
      const value = variable()

      const subscription = yield* replica.subscribe({
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

      const reader = subscription.fork().getReader()
      const { value: initial } = yield* Task.wait(reader.read())

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

      yield* Replica.transact(replica, [
        { Retract: [member, 'message', "You've got an email!"] },
        { Assert: [member, 'message', 'You have an email!'] },
      ])

      const { value: updated } = yield* Task.wait(reader.read())

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
