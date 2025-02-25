import * as Subscription from './subscription.js'
import * as Query from './query.js'
import * as Memory from 'synopsys/store/memory'
import * as Synopsys from 'synopsys'

export const testLocal = {
  subscription: Subscription.testSubscription({
    *connect() {
      const store = yield* Memory.open()
      const source = yield* Synopsys.Source.open(store)
      const replica = yield* Synopsys.open({ local: { source } })
      return replica
    },
  }),

  query: Query.testQuery({
    *connect() {
      const store = yield* Memory.open()
      const source = yield* Synopsys.Source.open(store)
      const replica = yield* Synopsys.open({ local: { source } })
      return replica
    },
  }),
}
