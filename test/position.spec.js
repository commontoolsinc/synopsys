import * as Position from '../src/position/lib.js'

/**
 * @type {[string, string][]}
 */
const BASE_95_increments = [
  ['a0', 'a1'],
  ['a1', 'a2'],
  ['a~', 'b'],
  ['a0z', 'a0{'],
  ['a0{', 'a0|'],
  ['a0|', 'a0}'],
  ['a0}', 'a0~'],
  ['a0~', 'a1'],
  ['b0z', 'b0{'],
  ['b0~', 'b1'],
  ['b1~', 'b2'],
  ['b~~', 'c'],
  ['Zy', 'Zz'],
  ['Z~', '['],
  ['`~', 'a'],
  ['Yzy', 'Yzz'],
  // ['Yzz', 'Z0'],
  // ['Xyzz', 'Xz00'],
  ['Xz00', 'Xz01'],
  // ['Xzzz', 'Y00'],
  // ['dABzz', 'dAC00'],
]

const after = [
  ['a', 'a1'], // trailing zeros are ignore
  ['_1', 'a'], // invalid range characters are skipped
  ['0', 'A'], // incrementing a major digit
  ['023242', 'A'], // incrementing a major digit
  ['a00', 'a1'], // patch component is dropped when incrementing
  ['a0', 'a1'], // trailing do not affect increment
  ['a1', 'a2'], // incrementing a minor digit
  ['az', 'b'], // incrementing a major digit
  ['b', 'b01'], // incrementing a minor digit
  ['b0z', 'b1'], // incrementing a major digit and trim
  ['b1', 'b11'], // incrementing a minor digit
  ['b1z', 'b2'], // incrementing a major digit
  ['bzz', 'c'], // incrementing a major digit
  ['c', 'c001'], // incrementing a minor digit
  ['Zy', 'Zz'], // incrementing a minor digit
  ['Zz', 'a'],
  ['Yzy', 'Yzz'],
  ['Yzz', 'Z'],
  ['Xyzz', 'Xz'],
  ['Xz00', 'Xz01'],
  ['Xz', 'Xz01'],
  ['Xz0', 'Xz01'],
  ['Xzzz', 'Y'],
  ['Xzzz01', 'Y'],
  ['dABzz', 'dAC'],
  ['z', 'z00000000000000000000000001'], // incrementing a minor digit
  ['zzzzzzzzzzzzzzzzzzzzzzzzzzz', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzV'], // incrementing a patch
  ['~', '~V'], // incrementing a on invalid range
  ['~V', '~W'], // incrementing a on invalid range
  ['~W', '~X'], // incrementing a on invalid range
  ['~X', '~Y'], // incrementing a on invalid range
  ['~Z', '~a'], // incrementing a on invalid range
  ['~z', '~zV'], // incrementing a on invalid range
  ['~zV', '~zW'], // incrementing a on invalid range
]

const before = [
  ['a1', 'a'],
  ['a2', 'a1'],
  ['b00', 'az'],
  ['b10', 'b0z'],
  ['b20', 'b1z'],
  ['c000', 'bzz'],
  ['Zz', 'Zy'],
  ['a0', 'Zz'],
  ['Yzz', 'Yzy'],
  ['Z0', 'Yzz'],
  ['Xz00', 'Xyzz'],
  ['Xz01', 'Xz'],
  ['Y00', 'Xzzz'],
  ['dAC00', 'dABzz'],
  ['A00000000000000000000000000', 'A'],
  ['A00000000000000000000000001', 'A'],
  ['A00000000000000000000000002', 'A00000000000000000000000001'],
  ['A00000000000000000000000011', 'A0000000000000000000000001'],
  ['~', 'zzzzzzzzzzzzzzzzzzzzzzzzzzz'],
  ['~1089', 'zzzzzzzzzzzzzzzzzzzzzzzzzzz'],
  ['_a', 'Zz'],
  ['Zz2', 'Zy'],
]

const empty = new Uint8Array()

/**
 * @type {import('entail').Suite}
 */
export const testDigits = {
  // ...Object.fromEntries(
  //   BASE_95_increments.map(([digits, consequent]) => [
  //     `base95.increment(${digits}) => ${consequent}`,
  //     (assert) => {
  //       const actual = Digits.increment(Digits.fromString(digits))
  //       const expect = Digits.fromString(consequent)
  //       assert.equal(actual.toString(), expect.toString())
  //     },
  //   ])
  // ),
  ...Object.fromEntries(
    after.map(([position, expect]) => [
      `Position.insert(null, { after: "${position}" })) => ${expect}`,
      (assert) => {
        const actual = Position.insert(empty, { after: position })

        assert.ok(position <= actual, `${position} <= ${actual}`)
        assert.equal(expect, actual)
      },
    ])
  ),

  ...Object.fromEntries(
    before.map(([position, expect]) => [
      `Position.insert(null, { before: "${position}" })) => ${expect}`,
      (assert) => {
        const actual = Position.insert(empty, { before: position })

        assert.ok(position >= actual, `${position} >= ${actual}`)
        assert.equal(expect, actual)
      },
    ])
  ),
}
