import * as DB from 'datalogia'
import { Task, Agent, refer, variable } from 'synopsys'
import * as Memory from 'synopsys/store/memory'

/**
 * @type {import('entail').Suite}
 */
export const testSubscription = {
  'iterate subscription': (assert) =>
    Task.spawn(function* () {
      const store = yield* Memory.open()
      const agent = yield* Agent.open({ local: { store } })

      const stuff = refer({ collection: 'stuff' })
      const member = refer({ member: 'email', of: stuff })

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

      const selections = take(subscription, 2)

      yield* DB.transact(agent, [
        { Assert: [stuff, 'member', member] },
        { Assert: [member, 'message', "You've got an email!"] },
      ])

      yield* Task.sleep(1)

      yield* DB.transact(agent, [
        { Assert: [member, 'comment', 'does not affect query'] },
      ])

      yield* Task.sleep(1)

      yield* DB.transact(agent, [
        { Retract: [member, 'message', "You've got an email!"] },
        { Assert: [member, 'message', 'You have an email!'] },
      ])

      const output = yield* Task.wait(selections)

      assert.deepEqual(output, [
        [
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
        ],
        [
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
        ],
      ])
    }),
  'poll subscription': (assert) =>
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

/**
 * @template {Agent.Selector} Select
 * @param {number} limit
 * @param {Agent.Subscription<Select>} subscription
 */
const take = async (subscription, limit = Infinity) => {
  const results = []
  for await (const selection of subscription) {
    results.push(selection)
    if (results.length >= limit) {
      break
    }
  }
  return results
}
