import * as Position from './position.js'
import * as UTF8 from '../utf8.js'

/**
 * @typedef {string} At
 */

/**
 * @param {string} at
 */
export const toPosition = (at) => UTF8.toUTF8(at)

/**
 * @param {Uint8Array} position
 * @returns {At}
 */
export const fromPosition = (position) => UTF8.fromUTF8(position)

/**
 * @param {Uint8Array} bias
 * @param {object} at
 * @param {At} [at.after]
 * @param {At} [at.before]
 */
export const insert = (bias, { after, before }) =>
  fromPosition(
    Position.insert(bias, {
      after: after ? toPosition(after) : undefined,
      before: before ? toPosition(before) : undefined,
    })
  )
