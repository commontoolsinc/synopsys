import * as Memory from 'synopsys/store/memory'
import * as LMDB from '../src/store/lmdb.js'
import { transact } from 'datalogia'
import * as OS from 'node:os'
import { refer, Task, Source } from 'synopsys'
import { pathToFileURL } from 'node:url'
import FS from 'node:fs'

/**
 * @type {import('entail').Suite}
 */
export const testScan = {
  'empty db has canonical status': (assert) =>
    Task.spawn(function* () {
      const db = yield* Memory.open()
    }),
  'transaction updates id': (assert) =>
    Task.spawn(function* () {
      const { tx } = yield* loadTodo()
      assert.equal(tx.before.id, 'NcuV3vKyQgcxiZDMdE37fv')
      assert.notEqual(tx.before.id, tx.after.id)
    }),
  'status reports current revision': (assert) =>
    Task.spawn(function* () {
      const { db, tx } = yield* loadTodo()
    }),
  'scan by entity': (assert) =>
    Task.spawn(function* () {
      const { db, cause, list, milk, eggs, bread } = yield* loadTodo()
      assert.deepEqual(
        new Set(yield* Memory.scan(db, { entity: list })),
        new Set(
          /** @type {const} */ ([
            [list, 'title', 'Todo List', cause],
            [list, 'todo', milk, cause],
            [list, 'todo', eggs, cause],
            [list, 'todo', bread, cause],
          ])
        )
      )

      assert.deepEqual(
        new Set(yield* Memory.scan(db, { entity: milk })),
        new Set(/** @type {const} */ ([[milk, 'title', 'Buy Milk', cause]]))
      )
    }),
  'scan by attribute': (assert) =>
    Task.spawn(function* () {
      const { db, cause, list, milk, eggs, bread } = yield* loadTodo()
      assert.deepEqual(
        new Set(yield* Memory.scan(db, { attribute: 'todo' })),
        new Set(
          /** @type {const} */ ([
            [list, 'todo', eggs, cause],
            [list, 'todo', milk, cause],
            [list, 'todo', bread, cause],
          ])
        )
      )
    }),
  'scan by value': (assert) =>
    Task.spawn(function* () {
      const { db, cause, tx, list, milk, eggs, bread } = yield* loadTodo()

      assert.deepEqual(
        new Set(yield* Memory.scan(db, { value: eggs })),
        new Set(/** @type {const} */ ([[list, 'todo', eggs, cause]]))
      )
    }),
  'scan by attribute & value': (assert) =>
    Task.spawn(function* () {
      const { db, cause, tx, list, milk, eggs, bread } = yield* loadTodo()

      assert.deepEqual(
        new Set(yield* Memory.scan(db, { attribute: 'todo', value: eggs })),
        new Set(/** @type {const} */ ([[list, 'todo', eggs, cause]]))
      )
    }),
  'full scan': (assert) =>
    Task.spawn(function* () {
      const { db, cause, tx, list, milk, eggs, bread } = yield* loadTodo()

      assert.deepEqual(
        new Set(yield* Memory.scan(db, {})),
        new Set(
          /** @type {const} */ ([
            [milk, 'title', 'Buy Milk', cause],
            [eggs, 'title', 'Buy Eggs', cause],
            [bread, 'title', 'Buy Bread', cause],
            [bread, 'done', true, cause],
            [list, 'title', 'Todo List', cause],
            [list, 'todo', bread, cause],
            [list, 'todo', eggs, cause],
            [list, 'todo', milk, cause],
            [cause, 'db/source', Memory.CBOR.encode(tx.cause), cause],
          ])
        )
      )
    }),
  'scan by entity, attribute, value': (assert) =>
    Task.spawn(function* () {
      const { db, cause, bread } = yield* loadTodo()

      // not found if does not match
      assert.deepEqual(
        yield* Memory.scan(db, {
          entity: bread,
          attribute: 'done',
          value: false,
        }),
        []
      )

      // finds if matches
      assert.deepEqual(
        yield* Memory.scan(db, {
          entity: bread,
          attribute: 'done',
          value: true,
        }),
        /** @type {const} */ ([[bread, 'done', true, cause]])
      )
    }),
  'leaves EAVT entries with missmatched values': (assert) =>
    Task.spawn(function* () {
      const { db, cause, bread, list } = yield* loadTodo()

      const matches = yield* Memory.scan(db, { entity: list, value: bread })

      assert.deepEqual(matches, [[list, 'todo', bread, cause]])
    }),
  'retract fact': (assert) =>
    Task.spawn(function* () {
      const { db, cause, bread } = yield* loadTodo()

      const tx = yield* Memory.transact(db, [
        { Retract: [bread, 'done', true] },
      ])
      assert.deepEqual(
        new Set(yield* Memory.scan(db, { entity: bread })),
        new Set(/** @type {const} */ ([[bread, 'title', 'Buy Bread', cause]]))
      )
    }),
  'works with LMDB': (assert) =>
    Task.spawn(function* () {
      const temp = pathToFileURL(OS.tmpdir())
      const url = new URL('./datura-test', `${temp}/`)
      const { db, tx } = yield* loadTodo(url)
      try {
        assert.deepEqual(tx.before.id, 'NcuV3vKyQgcxiZDMdE37fv')
      } finally {
        FS.rmSync(url, { recursive: true })
        yield* Memory.close(db)
      }
    }),
}

/**
 *
 * @param {URL} [url]
 */
function* loadTodo(url) {
  const store = url ? yield* LMDB.open({ url }) : yield* Memory.open()
  const db = yield* Source.open(store)

  const list = refer({ title: 'Todo List' })
  const milk = refer({ title: 'Buy Milk' })
  const eggs = refer({ title: 'Buy Eggs' })
  const bread = refer({ title: 'Buy Bread', done: true })

  const tx = yield* transact(db, [
    { Assert: [list, 'title', 'Todo List'] },
    { Assert: [list, 'todo', milk] },
    { Assert: [milk, 'title', 'Buy Milk'] },
    { Assert: [list, 'todo', eggs] },
    { Assert: [eggs, 'title', 'Buy Eggs'] },
    { Assert: [list, 'todo', bread] },
    { Assert: [bread, 'title', 'Buy Bread'] },
    { Assert: [bread, 'done', true] },
  ])

  const cause = refer(tx.cause)

  return {
    db,
    cause,
    list,
    milk,
    eggs,
    bread,
    tx,
  }
}
