import * as Position from './position.js'
import * as Digits from './digits.js'
import * as Digit from './digit.js'
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
 * @param {Uint8Array} item
 * @returns {Uint8Array & Digits.Uint8[]}
 */
export const deriveBias = (item) =>
  /** @type {Uint8Array & Digits.Uint8[]} */ (
    Digits.toBase(item, Digits.base62)
  )

/**
 * @param {Uint8Array} item - Uint8Array representation of the unique item
 * identifier it could be
 *
 * @param {object} at
 * @param {At} [at.after]
 * @param {At} [at.before]
 */
export const insert = (item, { after, before }) =>
  fromPosition(
    Position.insert(deriveBias(item), {
      after: after ? toPosition(after) : undefined,
      before: before ? toPosition(before) : undefined,
    })
  )
