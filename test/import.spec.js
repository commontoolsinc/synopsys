import * as Memory from 'synopsys/store/memory'
import { Replica, Task, refer, $ } from 'synopsys'
import { query } from 'datalogia'

/**
 * @type {import('entail').Suite}
 */
export const testImport = {
  'test import object': (assert) =>
    Task.spawn(function* () {
      const store = yield* Memory.open()
      const replica = yield* Replica.open({ local: { store } })

      const source = {
        name: 'synopsys',
        keywords: ['datalog', 'db', 'datomic', 'graph'],
        null: null,
        dev: true,
        score: 1024n,
        dependencies: {
          '@canvas-js/okra': '0.4.5',
          '@canvas-js/okra-lmdb': '0.2.0',
          '@canvas-js/okra-memory': '0.4.5',
          '@ipld/dag-cbor': '^9.2.1',
          '@ipld/dag-json': '10.2.2',
          '@noble/hashes': '1.3.3',
          '@types/node': '22.5.5',
          datalogia: '^0.9.0',
          multiformats: '^13.3.0',
          'merkle-reference': '^0.0.3',
        },
        types: [{ './src/lib.js': './dist/lib.d.ts' }],
      }

      const entity = refer(source)
      const commit = yield* Replica.transact(replica, [{ Import: source }])

      const {
        name,
        dependencies,
        keywords,
        at,
        keyword,
        dependency,
        version,
        nil,
      } = $

      // TODO: Update test when grouping issue is fixed
      // @see https://github.com/Gozala/datalogia/issues/50
      const [groupKeywords] = yield* query(store, {
        select: {
          name,
          keywords: [{ at, keyword }],
          // dependencies: [{ name: dependency, version }],
        },
        where: [
          { Case: [entity, 'name', name] },
          { Case: [entity, 'null', nil] },
          // { Case: [entity, 'dependencies', dependencies] },
          { Case: [entity, 'keywords', keywords] },
          { Case: [keywords, at, keyword] },
          // { Case: [dependencies, dependency, version] },
        ],
      })

      const foundKeywords = groupKeywords.keywords
        .sort((left, right) => left.at.localeCompare(right.at))
        .map(({ keyword }) => keyword)

      assert.deepEqual(foundKeywords, source.keywords)

      const [match] = yield* query(store, {
        select: {
          name,
          null: $.null,
          score: $.score,
          dev: $.dev,
        },
        where: [
          { Case: [entity, 'name', name] },
          { Case: [entity, 'null', $.null] },
          { Case: [entity, 'score', $.score] },
          { Case: [entity, 'dev', $.dev] },
        ],
      })

      assert.deepEqual(match, {
        name: source.name,
        null: source.null,
        score: Number(source.score),
        dev: source.dev,
      })
    }),
}
