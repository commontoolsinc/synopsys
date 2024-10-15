import * as DB from '../src/lib.js'
import { transact, query, Var, match, not } from 'datalogia'

import * as OS from 'node:os'
import { Link, Task } from '../src/lib.js'
import { pathToFileURL } from 'node:url'
import FS from 'node:fs'

/**
 * @type {import('entail').Suite}
 */
export const testQuery = {
  selector: (assert) =>
    Task.spawn(function* () {
      const { db } = yield* open()

      const list = Var.link()
      const title = Var.string()
      const name = Var.string()
      const done = Var.boolean()
      const todo = Var.link()

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
}

/**
 *
 * @param {URL} [url]
 */
function* open(url) {
  const db = yield* DB.open(url)

  const groceries = Link.of({ name: 'Groceries' })
  const chores = Link.of({ name: 'Chores' })

  const milk = Link.of({ title: 'Buy Milk' })
  const eggs = Link.of({ title: 'Buy Eggs' })
  const bread = Link.of({ title: 'Buy Bread', done: true })

  const laundry = Link.of({ title: 'Do Laundry' })
  const dishes = Link.of({ title: 'Do Dishes' })

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

  const cause = DB.Link.of(tx.cause)

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
