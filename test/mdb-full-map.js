import { Link, Task } from '../src/lib.js'
import FS from 'node:fs/promises'
import * as Service from '../src/service.js'

/**
 * @type {import('entail').Suite}
 */
export const testLMDB = {
  'write many records': (assert) =>
    Task.spawn(function* () {
      const url = new URL(`./test-okra-limit`, import.meta.url)
      yield* Task.wait(FS.rm(url, { recursive: true, force: true }))
      const synopsys = yield* Service.open(url)

      const size = 1
      let count = 1
      while (true) {
        console.log(`Importing ${count}...`)
        const { ok, error } = yield* Task.perform(
          Service.transact(synopsys, [...generateBatch(count, size)])
        ).result()

        if (error) {
          console.error(error)
          break
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
    yield { Assert: [Link.of({ count: i }), 'count', i] }
  }
}
