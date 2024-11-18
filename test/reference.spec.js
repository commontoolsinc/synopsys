import { refer } from 'synopsys'
import * as Reference from '../src/datum/reference.js'
import { base32 } from 'merkle-reference'

/**
 * @type {import('entail').Suite}
 */
export const testReference = {
  fromString: (assert) => {
    const hello = refer('hello')
    assert.deepEqual(hello, Reference.fromString(hello.toString()))
  },
  invalidStringReference: (assert) => {
    const hello = refer('hello')
    assert.throws(() => Reference.fromString('world'), /ReferenceError/)
    assert.throws(
      () => Reference.fromString(hello.toString().slice(0, -1)),
      /ReferenceError/
    )

    assert.throws(
      () => Reference.fromString(base32.encode(hello['/'].subarray(1, -1))),
      /ReferenceError/
    )

    const implicit = Reference.fromString('hello', hello)
    assert.deepEqual(implicit, hello)
  },
}
