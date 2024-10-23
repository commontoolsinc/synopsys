import * as Type from './agent/type.js'
import { Var } from 'datalogia'

export * from './agent/type.js'
export * as Agent from './agent.js'
export { transact, Task } from 'datalogia'
export { of as refer } from './datum/reference.js'

/**
 * @template {Type.Selector} [Select=Type.Selector]
 * @param {Type.Session} session
 * @param {Type.Query<Select>} query
 */
export const subscribe = (session, query) => session.subscribe(query)

/**
 * @returns {Type.Variable<any>}
 */
export const variable = () => Var.variable()
