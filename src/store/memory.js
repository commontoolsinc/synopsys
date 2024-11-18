import * as Memory from '@canvas-js/okra-memory'
export * from '../source/store.js'
import * as Store from './store.js'

/**
 * Opens a database instance at the given URL. If the URL is not provided or
 * has a `memory:` protocol, an ephemeral in-memory database returned. If the
 * URL has a `file:` protocol, a persistent LMDB backed database is returned.
 *
 * @typedef {Partial<import('@canvas-js/okra').Metadata>} Open
 *
 * @param {Open} [source]
 */
export function* open(source) {
  return Store.from(new Memory.Tree(source))
}
