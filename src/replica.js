import * as Query from './replica/query.js'
import * as Type from './replica/type.js'
import * as Local from './replica/session/local.js'
import * as Remote from './replica/session/remote.js'
import { refer } from './datum/reference.js'
import $, { variable } from './replica/query/scope.js'
export { Task } from 'datalogia'
export * from './replica/type.js'

export { _ } from 'datalogia'
export * from './replica/type.js'
export { refer, $, variable, Query, Type }
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
 * @typedef {object} ReplicaState
 * @property {Type.Replica} session
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

  return new Replica(session, new Map())
}

/**
 * @template {Type.Selector} [Select=Type.Selector]
 * @param {ReplicaState} self
 * @param {Type.Query<Select>} query
 * @returns {Type.Task<Type.Subscription<Select>, Error>}
 */
export function* subscribe({ session, subscriptions }, query) {
  const bytes = yield* Query.toBytes(query)
  const key = refer(bytes).toString()
  const subscription = subscriptions.get(key)
  if (!subscription) {
    const subscription = yield* session.subscribe(query)
    subscriptions.set(key, subscription)
    // Remove the subscription when it closes.
    subscription.closed.then(() => subscriptions.delete(key))
    return subscription
  }

  return /** @type {Type.Subscription<Select>} */ (subscription)
}

/**
 * @param {ReplicaState} self
 * @param {Type.Transaction} changes
 */
export const transact = ({ session }, changes) => session.transact(changes)

/**
 * @template {Type.Selector} [Select=Type.Selector]
 * @param {ReplicaState} self
 * @param {Type.Query<Select>} query
 */
export const query = ({ session }, query) => session.query(query)

class Replica {
  /**
   * @param {Type.Replica} session
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
  /**
   * @template {Type.Selector} [Select=Type.Selector]
   * @param {Type.Query<Select>} source
   */
  query(source) {
    return query(this, source)
  }
}
