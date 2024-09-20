import * as DB from '../src/lib.js'
import { transact } from 'datalogia'
import * as OS from 'node:os'
import { Link, Task } from '../src/lib.js'
import { pathToFileURL } from 'node:url'
import FS from 'node:fs'

/**
 * @type {import('entail').Suite}
 */
export const testScan = {
  'empty db has canonical status': (assert) =>
    Task.spawn(function* () {
      const db = yield* DB.open()
      const v = yield* DB.status(db)
      assert.deepEqual(v.id, 'NcuV3vKyQgcxiZDMdE37fv')
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
      assert.deepEqual(yield* DB.status(db), tx.after)
    }),
  'scan by entity': (assert) =>
    Task.spawn(function* () {
      const { db, cause, list, milk, eggs, bread } = yield* loadTodo()
      assert.deepEqual(
        new Set(yield* DB.scan(db, { entity: list })),
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
        new Set(yield* DB.scan(db, { entity: milk })),
        new Set(/** @type {const} */ ([[milk, 'title', 'Buy Milk', cause]]))
      )
    }),
  'scan by attribute': (assert) =>
    Task.spawn(function* () {
      const { db, cause, list, milk, eggs, bread } = yield* loadTodo()
      assert.deepEqual(
        new Set(yield* DB.scan(db, { attribute: 'todo' })),
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
        new Set(yield* DB.scan(db, { value: eggs })),
        new Set(/** @type {const} */ ([[list, 'todo', eggs, cause]]))
      )
    }),
  'scan by attribute & value': (assert) =>
    Task.spawn(function* () {
      const { db, cause, tx, list, milk, eggs, bread } = yield* loadTodo()

      assert.deepEqual(
        new Set(yield* DB.scan(db, { attribute: 'todo', value: eggs })),
        new Set(/** @type {const} */ ([[list, 'todo', eggs, cause]]))
      )
    }),
  'full scan': (assert) =>
    Task.spawn(function* () {
      const { db, cause, tx, list, milk, eggs, bread } = yield* loadTodo()

      assert.deepEqual(
        new Set(yield* DB.scan(db, {})),
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
            [cause, 'db/source', DB.CBOR.encode(tx.cause), cause],
          ])
        )
      )
    }),
  'scan by entity, attribute, value': (assert) =>
    Task.spawn(function* () {
      const { db, cause, bread } = yield* loadTodo()

      // not found if does not match
      assert.deepEqual(
        yield* DB.scan(db, { entity: bread, attribute: 'done', value: false }),
        []
      )

      // finds if matches
      assert.deepEqual(
        yield* DB.scan(db, { entity: bread, attribute: 'done', value: true }),
        /** @type {const} */ ([[bread, 'done', true, cause]])
      )
    }),

  'leaves EAVT entries with missmatched values': (assert) =>
    Task.spawn(function* () {
      const { db, cause, bread, list } = yield* loadTodo()

      const matches = yield* DB.scan(db, { entity: list, value: bread })

      assert.deepEqual(matches, [[list, 'todo', bread, cause]])
    }),
  'retract fact': (assert) =>
    Task.spawn(function* () {
      const { db, cause, bread } = yield* loadTodo()

      const tx = yield* DB.transact(db, [{ Retract: [bread, 'done', true] }])
      assert.deepEqual(
        new Set(yield* DB.scan(db, { entity: bread })),
        new Set(/** @type {const} */ ([[bread, 'title', 'Buy Bread', cause]]))
      )
    }),
  'throws on unknown urls': (assert) =>
    Task.spawn(function* () {
      const result = yield* DB.open(
        new URL('https://github.com/gozala/datura')
      ).result()

      assert.match(result?.error?.message, /Unsupported protocol\: https/)
    }),
  'works with LMDB': (assert) =>
    Task.spawn(function* () {
      const temp = pathToFileURL(OS.tmpdir())
      const url = new URL('./datura-test', `${temp}/`)
      const { db, tx } = yield* loadTodo(url)
      try {
        assert.deepEqual(tx.before.id, 'NcuV3vKyQgcxiZDMdE37fv')
        assert.deepEqual(yield* DB.status(db), tx.after)
      } finally {
        FS.rmdirSync(url, { recursive: true })
        yield* DB.close(db)
      }
    }),
}

/**
 *
 * @param {URL} [url]
 */
function* loadTodo(url) {
  const db = yield* DB.open(url)

  const list = Link.of({ title: 'Todo List' })
  const milk = Link.of({ title: 'Buy Milk' })
  const eggs = Link.of({ title: 'Buy Eggs' })
  const bread = Link.of({ title: 'Buy Bread', done: true })

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

  const cause = DB.Link.of(tx.cause)

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
