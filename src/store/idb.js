import * as Task from '../task.js'
import * as Type from './type.js'
import * as Tree from './idb/tree.js'
import { poll } from './idb/util.js'
/**
 * Opens a database instance at the given URL. If the URL is not provided or
 * has a `memory:` protocol, an ephemeral in-memory database returned. If the
 * URL has a `file:` protocol, a persistent LMDB backed database is returned.
 *
 * @typedef {object} OpenDB
 * @typedef {import('@canvas-js/okra').Metadata} Metadata
 *
 * @typedef {object} Address
 * @property {string} [name]
 * @property {number} [version]
 * @property {string} [store]
 * @property {Partial<Metadata>} [tree]
 *
 *
 * @typedef {Type.Variant<{
 *   url: URL,
 *   idb: Address
 * }>} Open
 *
 * @param {Open} [source]
 * @returns {Task.Task<Type.Store, Error>}
 */
export const open = function* (source) {
  const {
    name = 'synopsys',
    store = 'facts',
    version = 1,
    tree = {},
  } = source?.idb ? source.idb : source?.url ? fromURL(source.url) : {}

  const request = indexedDB.open(name, version)
  request.onupgradeneeded = () => {
    request.result.createObjectStore(store)
  }

  const db = yield* poll(request)
  return yield* Tree.open({ db, storeName: store, options: tree })
}

/**
 * @param {URL} url
 * @returns {Address}
 */
const fromURL = (url) => {
  const { pathname, searchParams } = url
  const [database, store] = pathname.split(':')
  const [name, revision] = database.split('@')
  const version = Number(revision) | 0
  const Q = Number(searchParams.get('Q'))
  const K = Number(searchParams.get('K'))

  const treeOptions = Q > 0 && K > 0 ? { tree: { Q, K } } : {}

  return {
    name,
    store,
    version: version,
    ...treeOptions,
  }
}
