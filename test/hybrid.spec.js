import { transact, query, Var, match, not, API } from 'datalogia'
import { refer, Task, $, Type, Hybrid } from 'synopsys'
import * as Memory from 'synopsys/store/memory'
import HybridSuite from './hybrid.js'

/**
 * @type {import('entail').Suite}
 */
export const testHybrid = HybridSuite({
  *open() {
    const durable = yield* Memory.open()
    const ephemeral = yield* Memory.open()
    return { durable, ephemeral }
  },
})
