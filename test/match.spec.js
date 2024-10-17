import * as DB from '../src/lib.js'
import * as Session from '../src/session.js'
import { Task } from '../src/lib.js'

/**
 * @type {import('entail').Suite}
 */
export const testQuery = {
  query: (assert) =>
    Task.spawn(function* () {
      const db = yield* DB.open()
      const collection = DB.Link.of({ collection: 'stuff' })
      const member = DB.Link.of({ member: 'email', of: collection })

      yield* DB.transact(db, [
        { Assert: [collection, 'member', member] },
        { Assert: [member, 'message', "You've got an email!"] },
      ])

      const session = yield* Session.open({
        source: db,
        query: {
          select: {
            collection: '?collection',
            item: [
              {
                item: '?item',
                key: '?key',
                value: '?value',
              },
            ],
          },
          where: [
            {
              Case: ['?collection', 'member', '?item'],
            },
            {
              Case: ['?item', '?key', '?value'],
            },
            {
              Match: [
                {
                  text: '?value',
                  pattern: '*email*',
                },
                'text/like',
              ],
            },
          ],
        },
      })

      const { product } = yield* Session.compute(session)

      assert.deepEqual(Object(product), [
        {
          collection,
          item: [
            {
              item: member,
              key: 'message',
              value: "You've got an email!",
            },
          ],
        },
      ])
    }),
}
