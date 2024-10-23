import * as Type from './type.js'
import { isLink } from 'multiformats/link'
import { refer, Reference } from 'merkle-reference'
import { code } from '@ipld/dag-cbor'

/**
 * @typedef {object} Options
 * @property {null|{}} [undefined] - Substitution for `undefined` values. If not
 * provided `undefined` values will be omitted.
 * @property {null|{}} [null] - Substitution for ``null` values. If not provided
 * `null` values will be omitted.
 * @property {null|{}} [symbol] - Substitution for `symbol` values. If not
 * provided symbols will be omitted.
 * @property {null|{}} [hole] - Substitution for the holes in the arrays.
 * @property {null|{}} implicit - Implicit DAG representation, which is used
 * if top level `undefined` value is provided. Or if `null` options is omitted
 * and top level `null` value is provided.
 *
 * @property {(link:import('multiformats/link').UnknownLink) => null|{}} [link] - Substitution for the IPLD links.
 */

/**
 * Takes an **acyclic** data and returns corresponding structure that can be
 * encoded via IPLD codec. By default object properties that are set to
 * `undefined` or a symbol will be omitted. Objects with `toJSON` method will
 * be substituted with the DAG of corresponding to the return of the `toJSON`
 * method. Array holes and `undefined` elements will be substituted with `null`.
 *
 * This substitutions make behavior consistent with `JSON.stringify` and avoids
 * errors produced by IPLD codecs when encountering `undefined` values or symbols.
 *
 * Substitution rules can be customized by providing `options` object.
 *
 * @param {unknown} data
 * @param {Options} options
 */
export const from = (
  data,
  options = { null: null, hole: null, implicit: null }
) => fromUnknown(data, options, new Set())

/**
 * @param {unknown} data
 * @param {Options} options
 * @param {Set<unknown>} seen
 * @returns {Type.Task<Type.DAG, TypeError>}
 */
function* fromUnknown(data, options, seen) {
  if (seen.has(data)) {
    throw new TypeError(`Can not encode circular structure`)
  }

  // This is a top level `undefined` as members are handled explicitly.
  // If we do not have substitution for it we return `implicit` representation.
  if (data === undefined) {
    return options.undefined === undefined
      ? options.implicit
      : options.undefined
  }

  // This is a top level `null` as members are handled explicitly.
  // If we do not have substitution for it we return `implicit` representation.
  if (data === null) {
    return options.null === undefined ? options.implicit : options.null
  }

  // This is a top `level` symbol as members are handled explicitly.
  // If we do not have substitution for it we return `implicit` representation.
  if (typeof data === 'symbol') {
    return options.symbol === undefined ? options.implicit : options.symbol
  }

  // If it is an IPLD link we return it as is.
  if (isLink(data)) {
    return options.link ? options.link(data) : data
  }

  // If it is a byte array we return it as is.
  if (ArrayBuffer.isView(data)) {
    return data
  }

  // If it is an array we iterate and collect all the members substituting
  // them as necessary.
  if (Array.isArray(data)) {
    seen.add(data)
    return yield* fromArray(data, options, new Set(seen))
  }

  // If it is an object with `toJSON` method we substitute it with the result
  // of importing `toJSON` method return value.
  if (typeof (/** @type {{toJSON?:unknown}} */ (data).toJSON) === 'function') {
    seen.add(data)
    const json = /** @type {{toJSON():unknown}} */ (data).toJSON()
    return yield* fromUnknown(json, options, new Set(seen))
  }

  // If any other object we are going to import it as an object.
  if (typeof data === 'object') {
    seen.add(data)
    return yield* fromObject(data, options, new Set(seen))
  }

  return data
}

/**
 * @param {unknown[]} data
 * @param {Options} options
 * @param {Set<unknown>} seen
 */
function* fromArray(data, options, seen) {
  seen.add(data)
  const elements = []
  for (const element of data) {
    switch (typeof element) {
      // If we encounter `undefined` a.k.a array hole we substitute with a
      // substitution for the hole or with a substitution for `undefined`.
      // If we have substitution for the hole we omit the element.
      case 'undefined': {
        if (options.hole !== undefined) {
          elements.push(options.hole)
        }
        break
      }
      // If element is a symbol we substitute it with a symbol substitution
      // if one is provided, otherwise we omit an element.
      case 'symbol': {
        if (options.symbol !== undefined) {
          elements.push(options.symbol)
        }
      }
      default: {
        // If element is `null` we substitute it with a substitution for `null`
        // when one is provided, otherwise we omit an element.
        if (element === null) {
          if (options.null !== undefined) {
            elements.push(options.null)
          }
        }
        // if any other element we import it into the DAG.
        else {
          elements.push(yield* fromUnknown(element, options, seen))
        }
        break
      }
    }
  }
  return elements
}

/**
 * @param {{}} data
 * @param {Options} options
 * @param {Set<unknown>} seen
 */
function* fromObject(data, options, seen) {
  /** @type {Record<string, unknown>} */
  const object = {}
  for (const [key, value] of Object.entries(data)) {
    switch (typeof value) {
      case 'undefined': {
        // Substitute `undefined` if we have a substitution otherwise skip
        if (options.undefined !== undefined) {
          object[key] = options.undefined
        }
        break
      }
      case 'symbol': {
        // Substitute `symbol` if we have a substitution otherwise skip
        if (options.symbol !== undefined) {
          object[key] = options.symbol
        }
        break
      }
      default: {
        if (value === null) {
          // Substitute `null` if we have a substitution otherwise skip
          if (options.null !== undefined) {
            object[key] = options.null
          }
        }
        // If we have anything else we import it into the DAG
        else {
          object[key] = yield* fromUnknown(value, options, seen)
        }
        break
      }
    }
  }
  return object
}

/**
 * @template {number} Code
 * @template {Type.DAG} T
 * @param {T} data
 * @param {Type.BlockEncoder<Code, Type.DAG>} encoder
 * @param {Options} [options]
 * @returns {Type.Task<Type.ByteView<T>, Error>}
 */
export function* encode(encoder, data, options) {
  const dag = yield* from(data, options)
  const bytes = encoder.encode(dag)
  return /** @type {Type.ByteView<T>} */ (bytes)
}

const REFERENCE_CODE = refer(null).code

/**
 *
 * @template {Type.DAG} T
 * @template {number} Code
 * @param {Type.BlockDecoder<Code, T>} decoder
 * @param {Type.ByteView<T>|Uint8Array} bytes
 * @returns {Type.Task<T, Error>}
 */
export function* decode(decoder, bytes) {
  const dag = decoder.decode(bytes)
  const form = yield* from(dag, {
    null: null,
    implicit: {},
    link: (link) => {
      if (link.code === REFERENCE_CODE) {
        return Reference.fromDigest(link.multihash.digest)
      } else {
        return link
      }
    },
  })

  return /** @type {T} */ (form)
}
