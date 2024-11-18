import * as Task from './task.js'

/**
 * @typedef {{url: URL}} Open
 */

/**
 * Connects to the  service by opening the underlying store.
 *
 * @param {Open} source
 */
export function* open(source) {
  if (source.url.protocol === 'memory:') {
    const Memory = yield* Task.wait(import('./blob/memory.js'))
    return yield* Memory.open(source)
  } else {
    const Disk = yield* Task.wait(import('./blob/disk.js'))
    return yield* Disk.open(source)
  }
}
