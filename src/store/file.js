import * as LMDB from '@canvas-js/okra-lmdb'
import * as Store from './okra.js'
export * as Store from './okra.js'
import { fileURLToPath } from 'node:url'
import { Task } from 'datalogia'

/**
 * Opens a database instance at the given URL. If the URL is not provided or
 * has a `memory:` protocol, an ephemeral in-memory database returned. If the
 * URL has a `file:` protocol, a persistent LMDB backed database is returned.
 *
 * @typedef {import('@canvas-js/okra-lmdb').TreeOptions} Options
 *
 * @param {URL} url
 * @param {Options} [options]
 */
export const open = (url, options) =>
  Store.open(new LMDB.Tree(fileURLToPath(url), options))
