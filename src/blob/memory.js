import * as Type from '../replica/type.js'

/**
 * @typedef {object} Self
 * @property {Map<string, Blob>} blobs
 *
 * @param {{}} options
 */
export function* open(options = {}) {
  return new BlobStore()
}

/**
 * @param {Self} self
 * @param {string} key
 * @param {Blob} blob
 */
export function* put({ blobs }, key, blob) {
  blobs.set(key, blob)
  return {}
}

/**
 *
 * @param {Self} self
 * @param {string} key
 */

export function* get({ blobs }, key) {
  const blob = blobs.get(key)
  if (blob) {
    return blob
  } else {
    throw new RangeError(`Blob ${key} not found`)
  }
}

/**
 * @implements {Type.BlobStore}
 */
class BlobStore {
  /**
   * @param {Map<string, Blob>} blobs
   */
  constructor(blobs = new Map()) {
    this.blobs = blobs
  }
  /**
   *
   * @param {string} key
   * @param {Blob} blob
   */
  put(key, blob) {
    return put(this, key, blob)
  }
  /**
   * @param {string} key
   */
  get(key) {
    return get(this, key)
  }
}
