import { refer } from './datum/reference.js'
import * as Type from './replica/type.js'
import { Constant } from 'datalogia'
import * as Position from './position/lib.js'
/**
 * @param {Type.Fact} fact
 */
export const toBytes = ([entity, attribute, value]) => {}

/**
 * @template {Type.Import} Source
 * @param {Source} source
 * @returns {Generator<Type.Fact, Type.Reference<Source>>}
 */
export const iterate = function* (source) {
  /** @type {Record<string, Type.Constant>} */
  const output = {}
  for (const [key, value] of Object.entries(source)) {
    switch (typeof value) {
      case 'boolean':
      case 'number':
      case 'bigint':
      case 'string':
        output[key] = value
        break
      case 'object': {
        if (Constant.is(value)) {
          output[key] = value
        } else if (Array.isArray(value)) {
          let at
          /** @type {Record<string, Type.Constant>} */
          const nested = {}
          for (const member of value) {
            if (Constant.is(member)) {
              const element = refer(member)
              at = Position.insert(element['/'].subarray(-4), { after: at })
              nested[at] = member
            } else {
              const element = yield* iterate(member)
              at = Position.insert(element['/'].subarray(-4), { after: at })
              nested[at] = element
            }
          }
          const entity = refer(Object.values(nested))
          for (const [at, element] of Object.entries(nested)) {
            yield [entity, at, element]
          }
          output[key] = entity
        } else {
          output[key] = yield* iterate(value)
        }
        break
      }
      /* c8 ignore next 2 */
      default:
        throw new TypeError(`Unsupported value type: ${value}`)
    }
  }

  const entity = refer(output)
  for (const [key, value] of Object.entries(output)) {
    yield [entity, key, value]
  }

  return entity
}
