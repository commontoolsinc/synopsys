import * as Subscription from './subscription.js'
import * as Memory from 'synopsys/store/memory'
import { Agent } from 'synopsys'

export const testLocal = {
  subscription: Subscription.testSubscription({
    *connect() {
      const store = yield* Memory.open()
      const agent = yield* Agent.open({ local: { store } })
      return agent
    },
  }),
}
