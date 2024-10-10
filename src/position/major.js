import * as Digit from './digit.js'
import * as Minor from './minor.js'
import { base58 as base } from './digits.js'
import * as Base from './base.js'

import { EQUAL, CONSECUTIVE } from './digits.js'

const [[outerNegative, innerNegative], [innerPositive, outerPositive]] =
  base.ranges

export { base }
export const MIN = Base.min(base)
export const MAX = Base.max(base)

export const min = new Uint8Array([MIN, ...new Uint8Array(MIN).fill(Minor.MIN)])
export const max = new Uint8Array([MAX, ...new Uint8Array(MAX).fill(Minor.MAX)])
export const zero = () => innerPositive

export { EQUAL, CONSECUTIVE }

/**
 * @typedef {Digit.Uint8} Uint8
 */

/**
 * Major byte describes the size range of the minor positions. It highly
 * recommended to use only bytes in the  'A-Za-z' character code range meaning
 *
 * ```
 * [65...90,  97..122]
 * ```
 *
 * Major codes like `z:65` and `a:97` denote two digit `Minor` range, codes `Y:66`
 * and `B:98` denote 3 digit `Minor`. Each subsequent `Major` denotes increasingly
 * large range for `Minor` position, making `A` and `z` a 27 digit ranges.
 *
 * While use of `Major` bytes between [90...122] is NOT RECOMMENDED we may still
 * encounter those in practice, therefor they demark `0` size `Minor` range
 * implying that rest of the bytes will constitute `Patch` digits. Same applies
 * to the ranges between [0...65] and [122...255]. In practice it would mean
 * that insertions outside of recommended range would not be able to take
 * advantage of producing small positions.
 *
 * @typedef {Digit.Uint8 & {Major?:{}}} Major
 */

/**
 * Derives capacity of the minor component from the major component. It is
 * designed such that minor components in the middle have smaller capacity
 * and those on the edges have larger capacity. This way we can increase
 * position size logarithmically when inserting items at the end or the start.
 *
 * @param {Major} major
 */
export const capacity = (major) => {
  if (major >= innerPositive && major <= outerPositive) {
    return major - innerPositive + 1
  } else if (major >= outerNegative && major <= innerNegative) {
    return innerNegative - major + 1
  } else {
    return 0
  }
}

/**
 * Decrement the `major` component. If the `major` component is already at the
 * minimum decremented digit would be out of bounds in which case `null` is
 * returned.
 *
 * Please note that passed `major` may be out of bounds (when bytes outside of
 * the recommended range are used) in such case decrement will either move it
 * to the nearest smaller value in supported range or return `null` if no such
 * value exists.
 *
 * @param {Major} major
 * @returns {Major|null}
 */
export const decrement = (major) => {
  const digit = Digit.decrement(major, base.ranges)
  if (digit < 0) {
    return null
  } else {
    return digit
  }
}

/**
 * Increment the `major` component. If the `major` component is already at the
 * maximum incremented digit would be out of bounds in which case `null` is
 * returned.
 *
 * Please note that passed `major` may be out of bounds (when bytes outside of
 * the recommended range are used) in such case increment will either move it
 * to the nearest greater value in supported range or return `null` if no such
 * value exists.
 *
 *
 * @param {Major} major
 * @returns {Major|null}
 */
export const increment = (major) => {
  const digit = Digit.increment(major, base.ranges)
  if (digit < 0) {
    return null
  } else {
    return digit
  }
}

/**
 *
 * @param {Major} from
 * @param {Major} to
 * @returns {Major|EQUAL|CONSECUTIVE}
 */
export const intermediate = (from, to) =>
  Digit.intermediate(from, to, base.ranges)

/**
 * @param {Uint8Array} position
 * @returns {Digit.Uint8}
 */
export const from = (position) => position[0]
