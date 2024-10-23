import { id } from 'merkle-reference'
import * as DB from 'datalogia'
import * as Query from './agent/query.js'
export * from './agent/type.js'
import * as Type from './agent/type.js'
import * as Local from './agent/session/local.js'
import * as Remote from './agent/session/remote.js'

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
  const key = id(bytes)
  const subscription = agent.subscriptions.get(key)
  if (!subscription) {
    const subscription = yield* agent.session.subscribe(query)
    agent.subscriptions.set(key, subscription)
    return subscription
  }

  return /** @type {Type.Subscription<Select>} */ (subscription)
}

/**
 *
 * @param {Agent} agent
 * @param {DB.Transaction} transaction
 * @returns
 */
export function* transact(agent, transaction) {
  return yield* DB.transact(agent.session, transaction)
}

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
   * @param {DB.Transaction} changes
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
}
