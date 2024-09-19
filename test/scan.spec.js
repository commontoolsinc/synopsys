import * as DB from '../src/lib.js'
import * as OS from 'node:os'
import { pathToFileURL } from 'node:url'
import FS from 'node:fs'

/**
 * @type {import('entail').Suite}
 */
export const testScan = {
  'empty db has canonical status': async (assert) => {
    const db = DB.open()
    const v = await DB.status(db)
    assert.deepEqual(v.id, 'NcuV3vKyQgcxiZDMdE37fv')
  },
  'transaction updates id': async (assert) => {
    const { tx } = await loadTodo()
    assert.equal(tx.before.id, 'NcuV3vKyQgcxiZDMdE37fv')
    assert.notEqual(tx.before.id, tx.after.id)
  },
  'status reports current revision': async (assert) => {
    const { db, tx } = await loadTodo()
    assert.deepEqual(await DB.status(db), tx.after)
  },
  'scan by entity': async (assert) => {
    const { db, cause, list, milk, eggs, bread } = await loadTodo()
    assert.deepEqual(
      new Set(await DB.scan(db, { entity: list })),
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
      new Set(await DB.scan(db, { entity: milk })),
      new Set(/** @type {const} */ ([[milk, 'title', 'Buy Milk', cause]]))
    )
  },
  'scan by attribute': async (assert) => {
    const { db, cause, list, milk, eggs, bread } = await loadTodo()
    assert.deepEqual(
      new Set(await DB.scan(db, { attribute: 'todo' })),
      new Set(
        /** @type {const} */ ([
          [list, 'todo', eggs, cause],
          [list, 'todo', milk, cause],
          [list, 'todo', bread, cause],
        ])
      )
    )
  },
  'scan by value': async (assert) => {
    const { db, cause, tx, list, milk, eggs, bread } = await loadTodo()

    assert.deepEqual(
      new Set(await DB.scan(db, { value: eggs })),
      new Set(/** @type {const} */ ([[list, 'todo', eggs, cause]]))
    )
  },
  'scan by attribute & value': async (assert) => {
    const { db, cause, tx, list, milk, eggs, bread } = await loadTodo()

    assert.deepEqual(
      new Set(await DB.scan(db, { attribute: 'todo', value: eggs })),
      new Set(/** @type {const} */ ([[list, 'todo', eggs, cause]]))
    )
  },
  'full scan': async (assert) => {
    const { db, cause, tx, list, milk, eggs, bread } = await loadTodo()

    assert.deepEqual(
      new Set(await DB.scan(db, {})),
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
  },
  'scan by entity, attribute, value': async (assert) => {
    const { db, cause, bread } = await loadTodo()

    // not found if does not match
    assert.deepEqual(
      await DB.scan(db, { entity: bread, attribute: 'done', value: false }),
      []
    )

    // finds if matches
    assert.deepEqual(
      await DB.scan(db, { entity: bread, attribute: 'done', value: true }),
      /** @type {const} */ ([[bread, 'done', true, cause]])
    )
  },

  'leaves EAVT entries with missmatched values': async (assert) => {
    const { db, cause, bread, list } = await loadTodo()

    const matches = await DB.scan(db, { entity: list, value: bread })

    assert.deepEqual(matches, [[list, 'todo', bread, cause]])
  },
  'retract fact': async (assert) => {
    const { db, cause, bread } = await loadTodo()

    const tx = await DB.transact(db, [{ Retract: [bread, 'done', true] }])
    assert.deepEqual(
      new Set(await DB.scan(db, { entity: bread })),
      new Set(/** @type {const} */ ([[bread, 'title', 'Buy Bread', cause]]))
    )
  },
  'throws on unknown urls': async (assert) => {
    assert.throws(
      () => DB.open(new URL('https://github.com/gozala/datura')),
      /Unsupported protocol\: https/
    )
  },
  'works with LMDB': async (assert) => {
    const temp = pathToFileURL(OS.tmpdir())
    const url = new URL('./datura-test', `${temp}/`)
    const { db, tx } = await loadTodo(url)
    try {
      assert.deepEqual(tx.before.id, 'NcuV3vKyQgcxiZDMdE37fv')
      assert.deepEqual(await DB.status(db), tx.after)
    } finally {
      FS.rmdirSync(url, { recursive: true })
      await DB.close(db)
    }
  },
}

/**
 *
 * @param {URL} [url]
 */
const loadTodo = async (url) => {
  const db = DB.open(url)

  const list = DB.Link.of({ title: 'Todo List' })
  const milk = DB.Link.of({ title: 'Buy Milk' })
  const eggs = DB.Link.of({ title: 'Buy Eggs' })
  const bread = DB.Link.of({ title: 'Buy Bread', done: true })

  const tx = await DB.transact(db, [
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
