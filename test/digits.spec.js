import * as Digits from '../src/position/digits.js'
import * as UTF from '../src/utf8.js'

export const increment = /** @type {const} */ ([
  ['a', 'b'],
  ['az', 'b'],
  ['0', '1'],
  ['10', '11'],
  ['9', 'A'],
  ['z', null],
  ['bcd111z', 'bcd112'],
])

export const decrement = /** @type {const} */ ([
  ['a', 'Z'],
  ['az', 'ay'],
  ['0', null],
  ['10', '0z'],
  ['101', '1'],
  ['120', '11z'],
  ['9', '8'],
  ['z', 'y'],
])

/**
 * @type {import('entail').Suite}
 */
export const testDigits = {
  increment: Object.fromEntries(
    increment.map(([input, expect]) => [
      `Digits.increment(${input}) => ${expect}`,
      (assert) => {
        const actual = Digits.increment(UTF.toUTF8(input), Digits.base62.ranges)
        assert.deepEqual(
          actual,
          expect ? UTF.toUTF8(expect) : expect,
          `${actual ? UTF.fromUTF8(actual) : null} == ${expect}`
        )
      },
    ])
  ),
  decrement: Object.fromEntries(
    decrement.map(([input, expect]) => [
      `Digits.decrement(${input}) => ${expect}`,
      (assert) => {
        const actual = Digits.decrement(UTF.toUTF8(input), Digits.base62.ranges)
        assert.deepEqual(
          actual,
          expect ? UTF.toUTF8(expect) : expect,
          `${actual ? UTF.fromUTF8(actual) : null} == ${expect}`
        )
      },
    ])
  ),
}
