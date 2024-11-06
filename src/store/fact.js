import * as Type from '../replica/type.js'
import { refer } from '../datum/reference.js'
import { Constant } from 'datalogia'

const { Bytes } = Constant

/**
 * @typedef {[entity: Uint8Array, attribute:Uint8Array, value: Uint8Array]} Fact
 *
 * @typedef {object} Revision
 * @property {Uint8Array} value
 * @property {Revision[]} cause
 *
 * @typedef {Revision[]} Repository
 */

/**
 * Initializes new repository with a given value.
 *
 * @param {Uint8Array} value
 */
export const init = (value) => [
  {
    value,
    cause: [],
  },
]

/**
 * @param {Repository} repository
 * @param {Uint8Array} value
 * @returns {Repository}
 */
export const commit = (repository, value) => {
  return [
    {
      value,
      cause: repository,
    },
  ]
}

/**
 * @param {Repository} local
 * @param {Repository} remote
 */
export const merge = (local, remote) => {
  const revisions = []

  // Iterate over the remote heads and check if they are
  // included by the local. If not, then it is a concurrent so
  // we include it in our revision set
  for (const revision of remote) {
    if (!includes(local, revision)) {
      revisions.push(revision)
    }
  }

  // Iterate over the local heads and check if they are included
  // by the remote. If not, then it is a concurrent revision and
  // we include it in our revision set.
  for (const revision of local) {
    if (!includes(remote, revision)) {
      revisions.push(revision)
    }
  }

  // We sort concurrent revisions in deterministic order so that winner is will
  // be the first item. This way on query we can simply take the first head.
  return revisions.sort((a, b) => compareBytes(refer(a)['/'], refer(b)['/']))
}

/**
 * @param {Repository} repository
 * @param {Revision} revision
 */
const includes = (repository, revision) => {
  for (const member of iterate(repository)) {
    if (equal(member, revision)) {
      return true
    }
  }

  return false
}

/**
 * Iterates the revisions in the breadth-first order.
 *
 * @param {Repository} repository
 */
function* iterate(repository) {
  const revisions = [...repository]
  while (revisions.length > 0) {
    let size = revisions.length
    let offset = 0
    while (offset < size) {
      const revision = revisions[offset]
      yield revision
      revisions.push(...revision.cause)
      offset += 1
    }
    revisions.splice(0, size)
  }
}

/**
 * Checks if two revisions are equal.
 *
 * @param {Revision} actual
 * @param {Revision} other
 */
const equal = (actual, other) => {
  if (!Bytes.equal(actual.value, other.value)) {
    return false
  }

  if (actual.cause.length !== other.cause.length) {
    return false
  }

  for (let i = 0; i < actual.cause.length; i++) {
    if (!equal(actual.cause[i], other.cause[i])) {
      return false
    }
  }

  return true
}

/**
 * @param {Uint8Array} self
 * @param {Uint8Array} other
 */
const compareBytes = (self, other) => {
  let size = Math.min(self.length, other.length)
  let offset = 0
  while (offset < size) {
    let diff = self[offset] - other[offset]
    if (diff !== 0) {
      return diff
    }
    offset += 1
  }
  return self.length - other.length
}
