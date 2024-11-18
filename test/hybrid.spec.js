import * as Memory from 'synopsys/store/memory'
import HybridSuite from './hybrid.js'

/**
 * @type {import('entail').Suite}
 */
export const testHybrid = HybridSuite({
  *spawn(work) {
    const durable = yield* Memory.open()
    const ephemeral = yield* Memory.open()
    yield* work({ durable, ephemeral })
  },
})
