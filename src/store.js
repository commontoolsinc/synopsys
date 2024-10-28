import { Task } from 'datalogia'
import * as Type from './agent/type.js'

/**
 * @typedef {import('./store/file.js').Open & {
 *  url: URL
 * }} Open
 */

/**
 * Connects to the  service by opening the underlying store.
 *
 * @param {Open} source
 */
export function* open(source) {
  if (source.url.protocol === 'memory:') {
    const Memory = yield* Task.wait(import('./store/memory.js'))
    return yield* Memory.open(source)
  } else {
    const Store = yield* Task.wait(import('./store/file.js'))
    return yield* Store.open(source)
  }
}
