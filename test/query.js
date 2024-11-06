import { Task, Replica, refer, $, Type } from 'synopsys'

/**
 * @param {object} options
 * @param {() => Task.Task<Replica.Session, Error>} options.connect
 * @returns {import('entail').Suite}
 */
export const testQuery = ({ connect }) => ({
  'perform query': (assert) =>
    Task.spawn(function* () {
      const replica = yield* connect()

      const stuff = refer({ collection: 'stuff' })
      const member = refer({ member: 'email', of: stuff })

      const { collection, item, key, value } = $

      const pull = () =>
        replica.query({
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
          /** @type {Type.Where} */
          where: [
            { Case: [collection, 'member', item] },
            { Case: [item, key, value] },
            { Match: [{ text: value, pattern: '*email*' }, 'text/like'] },
          ],
        })

      const empty = yield* pull()
      assert.deepEqual(empty, [])

      yield* replica.transact([
        { Assert: [stuff, 'member', member] },
        { Assert: [member, 'message', "You've got an email!"] },
      ])

      yield* Task.sleep(1)
      const first = yield* pull()
      assert.deepEqual(first, [
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
        { Assert: [member, 'comment', 'does not affect query'] },
      ])

      yield* Task.sleep(1)

      yield* replica.transact([
        { Retract: [member, 'message', "You've got an email!"] },
        { Assert: [member, 'message', 'You have an email!'] },
      ])

      const second = yield* pull()

      assert.deepEqual(second, [
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

      yield* replica.transact([{ Upsert: [member, 'message', 'No emails'] }])
      yield* Task.sleep(1)

      const third = yield* pull()

      assert.deepEqual(third, [
        {
          collection: stuff,
          item: [
            {
              item: member,
              key: 'message',
              value: 'No emails',
            },
          ],
        },
      ])
    }),
})
