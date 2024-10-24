import * as Type from './agent/type.js'

export * as Agent from './agent.js'
export * from './agent.js'
export { transact, Task } from 'datalogia'

/**
 * @template {Type.Selector} [Select=Type.Selector]
 * @param {Type.Session} session
 * @param {Type.Query<Select>} query
 */
export const subscribe = (session, query) => session.subscribe(query)
