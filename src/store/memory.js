import * as Memory from '@canvas-js/okra-memory'
import * as Store from './okra.js'
export * from './okra.js'

/**
 * Opens a database instance at the given URL. If the URL is not provided or
 * has a `memory:` protocol, an ephemeral in-memory database returned. If the
 * URL has a `file:` protocol, a persistent LMDB backed database is returned.
 *
 * @typedef {Partial<import('@canvas-js/okra').Metadata>} Open
 *
 * @param {Open} [source]
 */
export const open = (source) => Store.open(new Memory.Tree(source))