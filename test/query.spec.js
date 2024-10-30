import { Task, $, Query } from 'synopsys'

/**
 * @type {import('entail').Suite}
 */
export const testQuery = {
  variables: (assert) => {
    const { a } = $
    const { b } = $

    assert.equal(a, $.a)
    assert.equal(a.toString(), `?a`)
    assert.equal(b.toString(), `?b`)

    assert.notDeepEqual(a, b)

    assert.deepEqual(Symbol.toStringTag in a && a[Symbol.toStringTag], '?a')
    const inspect = Symbol.for('nodejs.util.inspect.custom')
    assert.deepEqual(
      inspect in a && typeof a[inspect] === 'function' && a[inspect](),
      '?a'
    )
  },
  'new scope': (assert) => {
    const $$ = new $()

    const { newScopeVar } = $$
    // Just making sure that newScopVar is not the first one
    $.oldScopeVar

    assert.notDeepEqual(newScopeVar, $.newScopeVar)
  },

  'symbol variable': (assert) => {
    const a = $[Symbol.for('foo')]

    assert.equal(a.toString(), `?@foo`)

    const $$ = new $()
    const b = $$[Symbol()]
    assert.equal(b.toString(), `?@1`)
  },
  'prototype variable': (assert) => {
    const { prototype } = $
    assert.equal(prototype.toString(), `?prototype`)
  },
  'has on scope': (assert) => {
    const $$ = new $()
    assert.equal('a' in $$, false)
    const { a } = $$
    assert.equal(String(a), `?a`)
    assert.equal('a' in $$, true)

    assert.deepEqual(Object.getOwnPropertyNames($$), ['a', 'prototype'])

    assert.equal($$.prototype.toString(), `?prototype`)

    assert.deepEqual(Object.getOwnPropertyNames($$), ['a', 'prototype'])
  },

  'scope can be forked': (assert) => {
    const main = new $()
    const { a } = main
    const { b } = main

    const fork = main()

    assert.equal(b, fork.b)
    assert.notEqual(main.c, fork.c)
  },

  'invalid query': (assert) =>
    Task.spawn(function* () {
      const { error: badQuery } = yield* Task.result(Query.fromJSON(5))
      assert.match(badQuery, /Invalid query, expected an object/)

      const { error: badSelect } = yield* Task.result(
        Query.fromJSON({
          select: [5],
          where: [],
        })
      )
      assert.match(badSelect, /Invalid query selector/)

      const { error: numSelect } = yield* Task.result(
        Query.fromJSON({
          select: 5,
          where: [],
        })
      )

      assert.match(numSelect, /.select must be an object or a tuple/)
    }),
}
