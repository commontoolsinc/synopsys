import { refer, Task } from 'synopsys'
import * as Hybrid from 'synopsys/store/hybrid'
import * as Memory from 'synopsys/store/memory'
import * as Service from '../src/service.js'
import * as Blobs from 'synopsys/blob/memory'
import * as Sync from '../src/sync.js'
/**
 * @type {import('entail').Suite}
 */
export const testSync = {
  'test sync protocol': (assert) =>
    Task.spawn(function* () {
      const data = yield* Memory.open()
      const sync = yield* Sync.open(data)
      const service = yield* Service.open({
        data,
        sync,
        blobs: yield* Blobs.open(),
      })
      const remote = yield* Hybrid.connect({
        remote: {
          url: new URL('memory:'),
          fetch: service.fetch.bind(service),
        },
      })

      const project = refer({ v: 0 })
      const author = refer({ v: 1 })

      const durable = yield* Memory.open()
      const ephemeral = yield* Memory.open()

      const local = Hybrid.from({ durable, ephemeral })

      yield* data.transact([
        { Assert: [project, 'name', 'synopsys'] },
        { Assert: [project, 'version', '1.0.0'] },
      ])

      yield* local.transact([
        { Assert: [project, 'author', author] },
        { Assert: [author, 'name', 'Alice'] },
      ])

      const result = yield* local.merge(remote)

      assert.deepEqual(result.local.hash, result.remote.hash, 'hashes match')
    }),
}
