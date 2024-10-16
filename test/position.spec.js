import * as Position from '../src/position/lib.js'

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
  ['c0zz', 'c1'],
  ['bcd111z', 'bce'], // patch is trimmed
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

export const insert = /** @type {const} */ ([
  [, , 'a'],
  [, 'a', 'Zz'],
  ['a0', , 'a1'],
  ['a0', 'a1', 'a0V'],
  ['a0V', 'a1', 'a0i'],
  ['Zz', 'a0', 'ZzV'],
  ['Zz', 'a1', 'a'],
  [, 'Y00', 'Xzzz'],
  ['bzz', , 'c'],
  ['a0', 'a0V', 'a0C'],
  ['a0', 'a0G', 'a0A'],
  ['b125', 'b129', 'b127'],
  ['a0', 'a1V', 'a1'],
  ['a0', 'a11', 'a1'],
  ['a0', 'a10', 'a0V'],
  ['a0', 'a11', 'a1'],
  ['Zz', 'a01', 'a'],
  ['bcd111z', 'bcd113', 'bcd112'],
  [, 'a0V', 'Zz'], // skip a because a0V could not have happened without `a`.
  // [, 'a0V', 'a'],
  [, 'b999', 'b98'], // b999 would not have happened without b99
  // [, 'b999', 'b99'],
  [, 'A00000000000000000000000000', 'A'],
  [, 'A000000000000000000000000001', 'A'],
  ['zzzzzzzzzzzzzzzzzzzzzzzzzzy', , 'zzzzzzzzzzzzzzzzzzzzzzzzzzz'],
  ['zzzzzzzzzzzzzzzzzzzzzzzzzzz', , 'zzzzzzzzzzzzzzzzzzzzzzzzzzzV'],
  ['a00', , 'a1'],
  ['a00', 'a1', 'a0V'],
  ['0', '1', '0V'],
  ['Y', '_', 'Z'],
  ['y', '{', 'z'],
  ['a01', 'a013', 'a012'],
  ['A', 'C', 'B'],
  ['A0', 'A2', 'A1'],
  ['a1', 'b1', 'a2'],
  ['a1a', 'a1c', 'a1b'],
  ['a1a', 'a1a', 'a1a'], // no positions in between
  ['a1a', 'a1b', 'a1aV'],
  // ['a1', 'a0', 'a1V'], // should error
])

const empty = new Uint8Array()

/**
 * @type {import('entail').Suite}
 */
export const testPositions = {
  after: Object.fromEntries(
    after.map(([position, expect]) => [
      `Position.insert(null, { after: "${position}" })) => ${expect}`,
      (assert) => {
        const actual = Position.insert(empty, { after: position })

        assert.ok(position <= actual, `${position} <= ${actual}`)
        assert.equal(actual, expect)
      },
    ])
  ),

  before: Object.fromEntries(
    before.map(([position, expect]) => [
      `Position.insert(null, { before: "${position}" })) => ${expect}`,
      (assert) => {
        const actual = Position.insert(empty, { before: position })

        assert.ok(position >= actual, `${position} >= ${actual}`)
        assert.equal(actual, expect)
      },
    ])
  ),

  insert: Object.fromEntries(
    insert.map(([after, before, expect]) => [
      `Position.insert(null, { before: ${before}, after: ${after} })) => ${expect}`,
      (assert) => {
        const actual = Position.insert(empty, { after, before })

        assert.equal(actual, expect)
        if (before) {
          assert.ok(actual <= before, `${actual} <= ${before}`)
        }
        if (after) {
          assert.ok(actual >= after, `${actual} >= ${after}`)
        }
      },
    ])
  ),

  'test bias': (assert) => {
    assert.equal(
      Position.insert(new Uint8Array(), { after: 'a' }),
      'a1',
      'no fractional without a bias'
    )

    assert.equal(
      Position.insert(new Uint8Array([5]), { after: 'a' }),
      'a15',
      'gets fraction with a bias'
    )

    assert.equal(
      Position.insert(new Uint8Array([255, 200]), { after: 'a' }),
      'a1h28',
      'gets fraction with a bias'
    )

    assert.equal(
      Position.insert(new Uint8Array([7, 255, 200]), { after: 'a' }),
      'a12cnm',
      'gets fraction with a bias'
    )

    assert.equal(
      Position.insert(new Uint8Array([7, 255, 200, 4, 2]), { after: 'a' }),
      'a1Bv4z5g',
      'gets fraction with a bias'
    )
  },

  'test reverse order': (assert) => {
    assert.equal(
      Position.insert(new Uint8Array(), { after: '¾', before: 'y' }),
      'z',
      'can take in reverse order'
    )
  },
  'test out of bound': (assert) => {
    assert.deepEqual(
      Position.Position.insert(new Uint8Array(), {
        after: new Uint8Array(['¾'.charCodeAt(0)]),
        before: new Uint8Array(['´'.charCodeAt(0)]),
      }),
      new Uint8Array(['¾'.charCodeAt(0), 'V'.charCodeAt(0)])
    )
  },

  'test implicit 0s': (assert) => {
    assert.deepEqual(
      Position.insert(new Uint8Array([0]), {
        before: 'a01',
        after: 'a013',
      }),
      'a012'
    )

    assert.deepEqual(
      Position.insert(new Uint8Array([0]), {
        after: 'a02',
        before: 'a013',
      }),
      'a01W'
    )
  },

  'insert after choose bias when between patches': (assert) => {
    assert.deepEqual(
      Position.insert(new Uint8Array([':'.charCodeAt(0)]), {
        after: 'zzzzzzzzzzzzzzzzzzzzzzzzzzz1',
      }),
      'zzzzzzzzzzzzzzzzzzzzzzzzzzzW'
    )
  },

  'insert after appends bias when bias is smaller': (assert) => {
    assert.deepEqual(
      Position.insert(new Uint8Array([':'.charCodeAt(0)]), {
        after: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzw',
      }),
      'zzzzzzzzzzzzzzzzzzzzzzzzzzzxW'
    )
  },

  'insert before choose bias when between patches': (assert) => {
    assert.deepEqual(
      Position.insert(new Uint8Array([':'.charCodeAt(0)]), {
        before: 'A00000000000000000000000000w',
      }),
      'A00000000000000000000000000W'
    )
  },

  'insert appends bias when greater than decremented patch': (assert) => {
    assert.deepEqual(
      Position.insert(new Uint8Array(['#'.charCodeAt(0)]), {
        before: 'A00000000000000000000000000w',
      }),
      'A00000000000000000000000000vz'
    )

    assert.ok('A00000000000000000000000000vz' < 'A00000000000000000000000000w')
  },

  'shortens patch when patch can not be decremented': (assert) => {
    assert.deepEqual(
      Position.insert(new Uint8Array(['#'.charCodeAt(0)]), {
        before: 'A0000000000000000000000000000',
      }),
      'A'
    )

    assert.ok('A' < 'A0000000000000000000000000000')
  },

  'consecutive patches': (assert) => {
    assert.deepEqual(
      Position.insert(new Uint8Array(['#'.charCodeAt(0)]), {
        after: 'a1A',
        before: 'a1B',
      }),
      'a1Az'
    )

    assert.ok('a1A' < 'a1Az')
    assert.ok('a1Az' < 'a1B')
  },

  'patches with bias': (assert) => {
    assert.deepEqual(
      Position.insert(new Uint8Array([':'.charCodeAt(0)]), {
        after: 'a1A',
        before: 'a1z',
      }),
      'a1W'
    )
  },

  'patch next out of bound': (assert) => {
    assert.deepEqual(
      Position.insert(new Uint8Array([':'.charCodeAt(0)]), {
        after: 'a1{',
        before: 'a2',
      }),
      'a1{W'
    )

    assert.ok('a1{' < 'a1{W')
    assert.ok('a1{W' < 'a2')
  },
}
