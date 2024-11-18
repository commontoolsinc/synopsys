import * as Task from '../../task.js'
import { KeyValueNodeStore } from '@canvas-js/okra'
import * as Okra from '@canvas-js/okra'

export { equalKeys, hashEntry, compareKeys } from '@canvas-js/okra'

/**
 *
 * @param {unknown} condition
 * @param {string} [message]
 * @param  {unknown[]} args
 * @returns {asserts condition}
 */
export function assert(condition, message, ...args) {
  if (!condition) {
    if (args && args.length > 0) {
      console.error(...args)
    }
    throw new Error(message ?? 'Internal error')
  }
}

/**
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Task.Task<T, Error>}
 */
export function* poll(request) {
  if (request.readyState === 'done') {
    return request.result
  }

  const invocation = yield* Task.fork(Task.suspend())
  const resume = () => {
    request.removeEventListener('success', resume)
    request.removeEventListener('error', resume)
    invocation.abort(Task.RESUME)
  }
  request.addEventListener('success', resume)
  request.addEventListener('error', resume)

  try {
    yield* invocation
  } catch {}

  if (request.error) {
    throw request.error
  } else {
    return request.result
  }
}

/**
 * @param {object} self
 * @param {Okra.Metadata} self.metadata
 * @param {Okra.Entry} entry
 * @returns {Okra.Node}
 */
export const parseEntry = (self, entry) =>
  // @ts-expect-error - typed as private method
  KeyValueNodeStore.prototype.parseEntry.call(self, entry)

/**
 *
 * @param {number} level
 * @param {Okra.Key} key
 * @returns {Uint8Array}
 */
export const createEntryKey = (level, key) => {
  if (key === null) {
    return new Uint8Array([level])
  }

  const entryKey = new Uint8Array(new ArrayBuffer(1 + key.length))
  entryKey[0] = level
  entryKey.set(key, 1)
  return entryKey
}

/**
 * @param {object} self
 * @param {Okra.Metadata} self.metadata
 * @returns
 */
export const getLeafAnchorHash = (self) =>
  KeyValueNodeStore.prototype.getLeafAnchorHash.call(self)

/**
 * Determines if a node is a boundary node.
 *
 * @param {object} settings
 * @param {number} settings.limit - The boundary limit.
 * @param {Okra.Node} node - The node to check.
 * @returns {boolean} True if the node is a boundary node.
 *
 * @protected
 */
export const isBoundary = ({ limit }, node) => {
  const view = new DataView(node.hash.buffer, node.hash.byteOffset, 4)
  return view.getUint32(0) < limit
}
