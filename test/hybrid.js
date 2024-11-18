import { transact, query } from 'datalogia'
import { refer, Task, $, Type, Hybrid } from 'synopsys'
/**
 * @param {object} options
 * @param {(work: (stores: { durable: Type.Store, ephemeral: Type.Store }) => Task.Task<unknown, Error>) => Task.Task<unknown, Error>} options.spawn
 * @returns {import('entail').Suite}
 */
export default ({ spawn }) => ({
  'local facts are ephemeral': (assert) =>
    spawn(function* ({ durable, ephemeral }) {
      const hybrid = yield* Hybrid.open({ ephemeral, durable })

      const provider = refer({
        service: { fetch: {} },
      })
      const request = {
        fetch: {
          url: 'https://api.example.com/data',
          method: 'GET',
        },
      }

      const init = yield* hybrid.transact([
        { Assert: [provider, '~/fetch', refer(request)] },
        { Assert: [refer(request), 'request/status', 'Pending'] },
      ])

      /**
       * @param {Type.DataSource} db
       */
      const queryJoint = (db) =>
        query(db, {
          select: {
            request: $.request,
            status: $.status,
          },
          where: [
            { Case: [provider, '~/fetch', $.request] },
            { Case: [$.request, 'request/status', $.status] },
          ],
        })

      assert.deepEqual(
        yield* queryJoint(hybrid),
        [{ request: refer(request), status: 'Pending' }],
        'returns results across both databases'
      )

      assert.deepEqual(
        yield* queryJoint(hybrid.durable),
        [],
        'fact is missing in durable database'
      )

      assert.deepEqual(
        yield* queryJoint(hybrid.ephemeral),
        [],
        'fact is missing in ephemeral database'
      )

      /**
       * @param {Type.DataSource} db
       */
      const queryLocal = (db) =>
        query(db, {
          select: {
            request: $.request,
          },
          where: [{ Case: [provider, '~/fetch', $.request] }],
        })

      assert.deepEqual(
        yield* queryLocal(hybrid),
        [{ request: refer(request) }],
        'returns results across both databases'
      )

      assert.deepEqual(
        yield* queryLocal(hybrid.durable),
        [],
        'fact is missing in durable database'
      )

      assert.deepEqual(
        yield* queryLocal(hybrid.ephemeral),
        [{ request: refer(request) }],
        'fact is found in ephemeral database'
      )

      /**
       * @param {Type.DataSource} db
       */
      const queryGlobal = (db) =>
        query(db, {
          select: {
            status: $.status,
          },
          where: [{ Case: [refer(request), 'request/status', $.status] }],
        })

      assert.deepEqual(
        yield* queryGlobal(hybrid),
        [{ status: 'Pending' }],
        'returns results across both databases'
      )

      assert.deepEqual(
        yield* queryGlobal(hybrid.ephemeral),
        [],
        'fact is missing in durable database'
      )

      assert.deepEqual(
        yield* queryGlobal(hybrid.durable),
        [{ status: 'Pending' }],
        'fact is found in durable database'
      )
    }),
})
