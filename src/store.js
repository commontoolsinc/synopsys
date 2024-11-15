import { Task } from 'datalogia'
import * as Type from './replica/type.js'

/**
 * @typedef {import('./store/lmdb.js').Open & {
 *  url: URL
 * }} Open
 */

/**
 * Connects to the  service by opening the underlying store.
 *
 * @param {Open} source
 * @returns {Task.Task<Type.Store, Error>}
 */
export function* open(source) {
  if (source.url.protocol === 'memory:') {
    const Memory = yield* Task.wait(import('./store/memory.js'))
    return yield* Memory.open(source)
  } else if (source.url.protocol === 'file:') {
    const LMDB = yield* Task.wait(import('./store/lmdb.js'))
    return yield* LMDB.open(source)
  } else if (source.url.protocol === 'idb:') {
    const IDB = yield* Task.wait(import('./store/idb.js'))
    return yield* IDB.open(source)
  } else {
    throw new Error(`Unsupported protocol: ${source.url.protocol}`)
  }
}
