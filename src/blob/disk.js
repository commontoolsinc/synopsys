import { writeFile, mkdir } from 'node:fs/promises'
import { openAsBlob } from 'node:fs'
import { Task } from 'datalogia'

/**
 * @typedef {object} Model
 * @property {URL} url
 *
 * @param {Model} options
 */
export function* open(options) {
  yield* Task.wait(mkdir(options.url, { recursive: true }))
  return new BlobStore(options)
}

/**
 * @param {Model} store
 * @param {string} key
 * @param {Blob} blob
 * @returns {Task.Task<{}, Error>}
 */
export function* put({ url }, key, blob) {
  const target = new URL(`${key}`, url)
  console.log(`Writing to ${target}`)
  const write = writeFile(target, blob.stream())
  yield* Task.wait(write)
  console.log(`Wrote to ${target}`)
  return {}
}

/**
 *
 * @param {Model} store
 * @param {string} key
 * @returns {Task.Task<Blob, Error>}
 */
export function* get({ url }, key) {
  const blob = yield* Task.wait(openAsBlob(new URL(`./${key}`, url)))
  return blob
}

class BlobStore {
  #options
  /**
   * @param {Model} options
   */
  constructor(options) {
    this.#options = options
  }
  get url() {
    return this.#options.url
  }
  /**
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
