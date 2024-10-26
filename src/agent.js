import * as Query from './agent/query.js'
import * as Type from './agent/type.js'
import * as Local from './agent/session/local.js'
import * as Remote from './agent/session/remote.js'
import { refer } from './datum/reference.js'
import $, { variable } from './agent/query/scope.js'

export { _ } from 'datalogia'
export * from './agent/type.js'
export { refer, $, variable, Query }
/**
 * Entity where we store synopsys related state.
 */
export const synopsys = refer({ synopsys: {} })

/**
 * @typedef {Type.Variant<{
 *   local: Local.Open
 *   remote: Remote.Open
 * }>} Open
 */

/**
 * @typedef {object} Agent
 * @property {Type.Session} session
 * @property {Map<string, Type.Subscription>} subscriptions
 */

/**
 *
 * @param {Open} options
 */
export function* open(options) {
  const session = options.local
    ? yield* Local.open(options.local)
    : yield* Remote.open(options.remote)

  return new AgentView(session, new Map())
}

/**
 * @template {Type.Selector} [Select=Type.Selector]
 * @param {Agent} agent
 * @param {Type.Query<Select>} query
 * @returns {Type.Task<Type.Subscription<Select>, Error>}
 */
export function* subscribe(agent, query) {
  const bytes = yield* Query.toBytes(query)
  const key = refer(bytes).toString()
  const subscription = agent.subscriptions.get(key)
  if (!subscription) {
    const subscription = yield* agent.session.subscribe(query)
    agent.subscriptions.set(key, subscription)
    // Remove the subscription when it closes.
    subscription.closed.then(() => agent.subscriptions.delete(key))
    return subscription
  }

  return /** @type {Type.Subscription<Select>} */ (subscription)
}

/**
 *
 * @param {Agent} agent
 * @param {Type.Transaction} changes
 */
export const transact = (agent, changes) => agent.session.transact(changes)

export class AgentView {
  /**
   * @param {Type.Session} session
   * @param {Map<string, Type.Subscription>} subscriptions
   */
  constructor(session, subscriptions) {
    this.session = session
    this.subscriptions = subscriptions
  }

  /**
   * @param {Type.Transaction} changes
   */
  transact(changes) {
    return transact(this, changes)
  }

  /**
   * @template {Type.Selector} [Select=Type.Selector]
   * @param {Type.Query<Select>} query
   */
  subscribe(query) {
    return subscribe(this, query)
  }

  toJSON() {
    return this
  }
}
