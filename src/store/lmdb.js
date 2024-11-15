import * as LMDB from '@canvas-js/okra-lmdb'
import * as Source from './okra.js'
import { fileURLToPath } from 'node:url'
import { Sync } from './store.js'

export * from './okra.js'

/**
 * Opens a database instance at the given URL. If the URL is not provided or
 * has a `memory:` protocol, an ephemeral in-memory database returned. If the
 * URL has a `file:` protocol, a persistent LMDB backed database is returned.
 *
 * @typedef {import('@canvas-js/okra-lmdb').TreeOptions & {
 *    url: URL
 * }} Open
 *
 * @param {Open} source
 */
export const open = ({ url, ...options }) =>
  Source.open(new Sync(new LMDB.Tree(fileURLToPath(url), options)))
