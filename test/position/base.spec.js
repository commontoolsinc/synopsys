import * as Base from '../../src/position/base.js'

const BASE62 = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`

/**
 * @type {import('entail').Suite}
 */
export const testBase = {
  testOversizedBase: (assert) => {
    assert.throws(
      () => Base.parse(`${BASE62}${BASE62}${BASE62}${BASE62}${BASE62}`),
      /RangeError/
    )
  },

  testBase62: (assert) => {
    const base = Base.parse(BASE62)

    assert.deepEqual(
      Base.toBase(new Uint8Array([0]), base),
      new Uint8Array([65])
    )
  },
}
