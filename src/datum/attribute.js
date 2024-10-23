import * as CBOR from '@ipld/dag-cbor'

/**
 * @typedef {import('datalogia').Attribute} Attribute
 */

/**
 * @param {Attribute} attribute
 */
export const toBytes = (attribute) => CBOR.encode(attribute)

/**
 *
 * @param {Uint8Array} bytes
 * @returns {Attribute}
 */
export const fromBytes = (bytes) => CBOR.decode(bytes)
