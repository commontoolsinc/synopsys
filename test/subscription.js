import { Task, Replica, refer, $ } from 'synopsys'

/**
 * @param {object} options
 * @param {() => Task.Task<Replica.Session, Error>} options.connect
 * @returns {import('entail').Suite}
 */
export const testSubscription = ({ connect }) => ({
  'iterate subscription': (assert) =>
    Task.spawn(function* () {
      const replica = yield* connect()

      const stuff = refer({ collection: 'stuff' })
      const member = refer({ member: 'email', of: stuff })

      const { collection, item, key, value } = $

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

      const selections = take(subscription, 3)

      yield* replica.transact([
        { Assert: [stuff, 'member', member] },
        { Assert: [member, 'message', "You've got an email!"] },
      ])

      yield* Task.sleep(1)

      yield* replica.transact([
        { Assert: [member, 'comment', 'does not affect query'] },
      ])

      yield* Task.sleep(1)

      yield* replica.transact([
        { Retract: [member, 'message', "You've got an email!"] },
        { Assert: [member, 'message', 'You have an email!'] },
      ])

      const output = yield* Task.wait(selections)

      assert.deepEqual(output, [
        [],
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
      const replica = yield* connect()

      const stuff = refer({ collection: 'stuff' })
      const member = refer({ member: 'email', of: stuff })

      yield* replica.transact([
        { Assert: [stuff, 'member', member] },
        { Assert: [member, 'message', "You've got an email!"] },
      ])

      const { collection, item, key, value } = $

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

      yield* replica.transact([
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
  'existing subscription': (assert) =>
    Task.spawn(function* () {
      const replica = yield* connect()

      const stuff = refer({ collection: 'stuff' })
      const member = refer({ member: 'email', of: stuff })

      yield* replica.transact([
        { Assert: [stuff, 'member', member] },
        { Assert: [member, 'message', "You've got an email!"] },
      ])

      const { collection, item, key, value } = $

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

      const duplicate = yield* replica.subscribe({
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

      assert.equal(subscription, duplicate)
    }),
})

/**
 * @template {Replica.Selector} Select
 * @param {number} limit
 * @param {Replica.Subscription<Select>} subscription
 */
const take = async (subscription, limit = Infinity) => {
  const results = []
  for await (const selection of subscription.fork()) {
    results.push(selection)
    if (results.length >= limit) {
      break
    }
  }
  return results
}
