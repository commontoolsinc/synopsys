import { transact, query, Var, match, not } from 'datalogia'
import { refer, Task, $ } from 'synopsys'
import * as IDB from 'synopsys/store/idb'
import HybridSuite from './hybrid.js'
import * as Memory from 'synopsys/store/memory'

/**
 * @type {import('entail').Suite}
 */
export const testQuery = {
  selector: (assert) =>
    Task.spawn(function* () {
      const { db } = yield* open()

      const { title, done, name, list, todo } = $

      const matches = yield* query(db, {
        select: {
          name,
          todo: [
            {
              title,
              done,
            },
          ],
        },
        where: [
          match([list, 'name', name]),
          match([list, 'todo', todo]),
          match([todo, 'title', title]),

          match([todo, 'done', done]).or(
            not(match([todo, 'done', done])).and({ Is: [done, false] })
          ),
        ],
      })

      assert.deepEqual(matches, [
        {
          name: 'Groceries',
          todo: [
            { title: 'Buy Bread', done: true },
            { title: 'Buy Eggs', done: false },
            { title: 'Buy Milk', done: false },
          ],
        },
        {
          name: 'Chores',
          todo: [
            { title: 'Do Laundry', done: false },
            { title: 'Do Dishes', done: false },
          ],
        },
      ])
    }),

  hybrid: HybridSuite({
    *open() {
      const durable = yield* IDB.open()
      const ephemeral = yield* Memory.open()
      return { durable, ephemeral }
    },
  }),
}

function* open() {
  const db = yield* IDB.open()

  const groceries = refer({ name: 'Groceries' })
  const chores = refer({ name: 'Chores' })

  const milk = refer({ title: 'Buy Milk' })
  const eggs = refer({ title: 'Buy Eggs' })
  const bread = refer({ title: 'Buy Bread', done: true })

  const laundry = refer({ title: 'Do Laundry' })
  const dishes = refer({ title: 'Do Dishes' })

  const tx = yield* transact(db, [
    { Assert: [groceries, 'name', 'Groceries'] },
    { Assert: [groceries, 'todo', milk] },
    { Assert: [milk, 'title', 'Buy Milk'] },
    { Assert: [groceries, 'todo', eggs] },
    { Assert: [eggs, 'title', 'Buy Eggs'] },
    { Assert: [groceries, 'todo', bread] },
    { Assert: [bread, 'title', 'Buy Bread'] },
    { Assert: [bread, 'done', true] },

    { Assert: [chores, 'name', 'Chores'] },
    { Assert: [chores, 'todo', laundry] },
    { Assert: [laundry, 'title', 'Do Laundry'] },
    { Assert: [chores, 'todo', dishes] },
    { Assert: [dishes, 'title', 'Do Dishes'] },
  ])

  const cause = refer(tx.cause)

  return {
    db,
    cause,
    groceries,
    chores,
    milk,
    eggs,
    bread,
    laundry,
    dishes,
    tx,
  }
}
