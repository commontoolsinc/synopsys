import { Replica, Task, refer } from 'synopsys'
import * as Store from 'synopsys/store/file'
import FS from 'node:fs/promises'
import * as Service from '../src/service.js'

/**
 * @type {import('entail').Suite}
 */
export const testLMDB = {
  'write many records': (assert) =>
    Task.spawn(function* () {
      const url = new URL(`./test-okra-limit`, import.meta.url)
      const json = new URL(`./test-flat-file.json`, import.meta.url)
      yield* Task.wait(FS.rm(url, { recursive: true, force: true }))
      // yield* Task.wait(FS.rm(json, { recursive: true, force: true }))
      const store = yield* Store.open({
        url,
        mapSize: 3 * 1024 * 1024 * 1024,
      })
      const replica = yield* Replica.open({
        local: { store },
      })

      const size = 1
      let count = 1
      // const file = yield* Task.wait(FS.open(json, 'a'))
      // file.write(`[\n`)
      while (true) {
        console.log(`Importing ${count}...`)
        const batch = [...generateBatch(count, size)]
        const { ok, error } = yield* Task.perform(
          Replica.transact(replica, batch)
        ).result()

        if (error) {
          // yield* Task.wait(file.write(`\n]\n`))
          console.error(error)
          break
        } else {
          // yield* Task.wait(file.write(JSON.stringify(batch, null, 2) + ',\n'))
        }
        count += size
      }
    }),
}

/**
 *
 * @param {number} start
 * @param {number} size
 * @returns {Service.DB.Transaction}
 */
const generateBatch = function* (start, size) {
  for (let i = start; i < start + size; i++) {
    yield { Assert: [refer({ count: i }), 'count', i] }
  }
}
