import { Task } from 'synopsys'
import * as DAG from '../src/replica/dag.js'
import { Link } from 'datalogia'
import * as CBOR from '@ipld/dag-cbor'

/**
 * @type {import('entail').Suite}
 */
export const testDAG = {
  testCicle: (assert) =>
    Task.spawn(function* () {
      const x = { y: { x: {} } }
      x.y.x = x

      const result = yield* Task.result(DAG.from(x))
      assert.match(result.error, /Can not encode circular/)
    }),

  'top is undefined': (assert) =>
    Task.spawn(function* () {
      const implicit = yield* Task.result(
        DAG.from(undefined, {
          implicit: 'implicit',
        })
      )

      assert.deepEqual(implicit.ok, 'implicit')

      const nil = yield* Task.result(
        DAG.from(undefined, {
          undefined: 'undefined',
          implicit: 'implicit',
        })
      )

      assert.deepEqual(nil.ok, 'undefined')
    }),

  'top is null': (assert) =>
    Task.spawn(function* () {
      const implicit = yield* Task.result(
        DAG.from(null, {
          implicit: 'implicit',
        })
      )

      assert.deepEqual(implicit.ok, 'implicit')

      const nil = yield* Task.result(
        DAG.from(null, {
          null: 'null',
          implicit: 'implicit',
        })
      )

      assert.deepEqual(nil.ok, 'null')
    }),

  'top is symbol': (assert) =>
    Task.spawn(function* () {
      const implicit = yield* Task.result(
        DAG.from(Symbol.for('top'), {
          implicit: 'implicit',
        })
      )

      assert.deepEqual(implicit.ok, 'implicit')

      const other = yield* Task.result(
        DAG.from(Symbol.for('top'), {
          symbol: 'symbol',
          implicit: 'implicit',
        })
      )

      assert.deepEqual(other.ok, 'symbol')
    }),

  bytes: (assert) =>
    Task.spawn(function* () {
      const bytes = yield* Task.result(
        DAG.from(new TextEncoder().encode('hello'))
      )

      assert.deepEqual(bytes.ok, new TextEncoder().encode('hello'))
    }),
  'top is array': (assert) =>
    Task.spawn(function* () {
      const array = yield* Task.result(DAG.from([1, 2, { x: 3 }]))

      assert.deepEqual(array.ok, [1, 2, { x: 3 }])
    }),

  'array substitutions': (assert) =>
    Task.spawn(function* () {
      const array = yield* Task.result(
        DAG.from([1, 2, , { x: 3 }, Symbol.for('test'), null], {
          hole: 'hole',
          implicit: null,
          symbol: 'symbol',
        })
      )

      assert.deepEqual(array.ok, [1, 2, 'hole', { x: 3 }, 'symbol', null])

      const substituteNull = yield* Task.result(
        DAG.from([1, 2, , { x: 3 }, Symbol.for('test'), null], {
          hole: 'hole',
          implicit: null,
          symbol: 'symbol',
          null: 'null',
        })
      )

      assert.deepEqual(substituteNull.ok, [
        1,
        2,
        'hole',
        { x: 3 },
        'symbol',
        'null',
      ])
    }),
  'object substitutions': (assert) =>
    Task.spawn(function* () {
      assert.deepEqual(
        yield* Task.result(
          DAG.from(
            { test: undefined, symbol: Symbol.for('test') },
            {
              hole: 'hole',
              implicit: null,
            }
          )
        ),
        {
          ok: {},
        }
      )

      assert.deepEqual(
        yield* Task.result(
          DAG.from(
            { test: undefined, symlink: Symbol.for('link') },
            {
              hole: 'hole',
              implicit: null,
              symbol: 'symbol',
              undefined: 'undefined',
            }
          )
        ),
        {
          ok: { test: 'undefined', symlink: 'symbol' },
        }
      )
    }),

  'decode link': (assert) =>
    Task.spawn(function* () {
      const duck = Link.of({ duck: {} })
      const stuff = yield* Task.result(DAG.decode(CBOR, CBOR.encode({ duck })))

      // @ts-expect-error
      assert.deepEqual(duck, stuff.ok?.duck)
    }),
}
