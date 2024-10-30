import * as CBOR from '@ipld/dag-cbor'
import { Link } from 'datalogia'
import * as Reference from './datum/reference.js'

/**
 * @param {import('datalogia').Datum} datum
 */
export const toBytes = ([entity, attribute, value, cause]) => {
  return CBOR.encode([entity, attribute, value, cause])
}

/**
 *
 * @param {Uint8Array} bytes
 * @returns {import('datalogia').Datum}
 */
export const fromBytes = (bytes) => {
  const [entity, attribute, value, cause] = CBOR.decode(bytes)
  return [
    Reference.from(entity),
    attribute,
    Reference.from(value),
    Reference.from(cause),
  ]
}
