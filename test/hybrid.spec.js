import { transact, query, Var, match, not, API } from 'datalogia'
import { refer, Task, $, Type } from 'synopsys'
import * as Hybrid from 'synopsys/store/hybrid'
import * as Memory from 'synopsys/store/memory'

import * as IDB from 'synopsys/store/idb'

/**
 * @type {import('entail').Suite}
 */
export const testHybrid = {
  'local facts are ephemeral': (assert) =>
    Task.spawn(function* () {
      const durable = yield* Memory.open()
      const ephemeral = yield* Memory.open()

      const hybrid = Hybrid.from({ ephemeral, durable })

      const provider = refer({
        service: { fetch: {} },
      })
      const request = {
        fetch: {
          url: 'https://api.example.com/data',
          method: 'GET',
        },
      }

      const init = yield* transact(hybrid, [
        { Assert: [provider, '~/fetch', refer(request)] },
        { Assert: [refer(request), 'request/status', 'Pending'] },
      ])

      /**
       * @param {Type.Database} db
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
        yield* queryJoint(durable),
        [],
        'fact is missing in durable database'
      )

      assert.deepEqual(
        yield* queryJoint(ephemeral),
        [],
        'fact is missing in ephemeral database'
      )

      /**
       * @param {Type.Database} db
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
        yield* queryLocal(durable),
        [],
        'fact is missing in durable database'
      )

      assert.deepEqual(
        yield* queryLocal(ephemeral),
        [{ request: refer(request) }],
        'fact is found in ephemeral database'
      )

      /**
       * @param {Type.Database} db
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
        yield* queryGlobal(ephemeral),
        [],
        'fact is missing in durable database'
      )

      assert.deepEqual(
        yield* queryGlobal(durable),
        [{ status: 'Pending' }],
        'fact is found in durable database'
      )
    }),
}
