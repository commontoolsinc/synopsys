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
  const entity = refer(source)
  for (const [key, value] of Object.entries(source)) {
    switch (typeof value) {
      case 'boolean':
      case 'number':
      case 'bigint':
      case 'string':
        yield [entity, key, value]
        break
      case 'object': {
        if (Constant.is(value)) {
          yield [entity, key, value]
        } else if (Array.isArray(value)) {
          let at
          const array = refer(value)
          for (const member of value) {
            if (Constant.is(member)) {
              const element = refer(member)
              at = Position.insert(element['/'].subarray(-4), { after: at })
              yield [array, at, member]
            } else {
              const element = yield* iterate(member)
              at = Position.insert(element['/'].subarray(-4), { after: at })
              yield [array, at, element]
            }
          }
          yield [entity, key, array]
        } else {
          const object = yield* iterate(value)
          yield [entity, key, object]
        }
        break
      }
      /* c8 ignore next 2 */
      default:
        throw new TypeError(`Unsupported value type: ${value}`)
    }
  }

  return entity
}
