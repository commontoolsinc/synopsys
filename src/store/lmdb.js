import * as LMDB from '@canvas-js/okra-lmdb'
import { fileURLToPath } from 'node:url'
import { Sync } from './store.js'

export * from '../source/store.js'

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
export function* open({ url, ...options }) {
  return new Sync(new LMDB.Tree(fileURLToPath(url), options))
}
