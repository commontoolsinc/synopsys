import * as DB from 'datalogia'
import * as Type from './type.js'
import * as Task from '../task.js'
import * as JSON from '@ipld/dag-json'
import * as DAG from './dag.js'
import { Var } from 'datalogia'
import { is as isReference } from '../datum/reference.js'
import Scope from './query/scope.js'

export const contentType = `application/synopsys-query+json`

/**
 * Takes JSON formatted query and return a query object with variables
 * expected by the database.
 *
 * @template {DB.Selector} [Select=DB.Selector]
 * @param {unknown} source
 * @returns {Task.Task<DB.Query<Select>, Error>}
 */

export const fromJSON = function* (source) {
  if (typeof source !== 'object' || source === null) {
    throw new TypeError(
      `Invalid query, expected an object instead got ${JSON.stringify(source)}`
    )
  }

  // Use a fresh variables environment for each query so that variable
  // identifiers are agnostic to any prior queries.
  const scope = new Scope()

  const select = yield* readSelect(
    /** @type {{select?:unknown}} */ (source)?.select ?? {},
    scope
  )

  const where = yield* readWhere(
    /** @type {{where?:unknown}} */ (source)?.where,
    scope
  )

  return /** @type {Type.Query<Select>} */ ({ select, where })
}

/**
 * Takes a query and encodes it byte-array in DAG-JSON format.
 *
 * @template {DB.Selector} [Select=DB.API.Selector]
 * @param {DB.Query<Select>} source
 * @returns {Type.Task<Type.ByteView<DB.Query<Select>>, Error>}
 */
export function* toBytes(source) {
  const query = yield* fromJSON(source)
  const bytes = yield* DAG.encode(JSON, query, {
    // Turn `null` and array hole into a unit and omit properties
    // set to `undefined` or symbols.
    null: {},
    hole: {},
    implicit: {},
  })
  return /** @type {Type.ByteView<DB.Query<Select>>} */ (bytes)
}

/**
 * Takes a query and decodes it from byte-array in DAG-JSON format.
 *
 * @template {DB.API.Selector} [Select=DB.API.Selector]
 * @param {Type.ByteView<DB.Query<Select>>|Uint8Array} bytes
 * @returns {Type.Task<DB.Query<Select>, Error>}
 */
export function* fromBytes(bytes) {
  const dag = yield* DAG.decode(JSON, bytes)
  const query = yield* fromJSON(dag)
  return /** @type {DB.Query<Select>}*/ (query)
}

/**
 * @param {unknown} source
 * @returns {source is `?${string}`}
 */
const isVariable = (source) =>
  Var.is(source) || (typeof source === 'string' && source.startsWith('?'))

/**
 * Takes JSON formatted `.select` clause of the DB query and returns a `select`
 * clause object with variables expected by the database along with extended
 * environment that contains all the referenced variables.
 *
 * @param {unknown} source
 * @param {DB.Variables} scope
 * @returns {Task.Task<DB.API.Selector, Error>}
 */

export const readSelect = function* (source, scope) {
  if (source && typeof source === 'object') {
    if (Array.isArray(source)) {
      const [member] = source
      if (isVariable(member)) {
        /** @type {DB.API.Selector} */
        return [scope[toKey(member)]]
      } else if (isObject(member)) {
        const select = yield* readSelect(member, scope)
        return [select]
      } else {
        throw new Error(`Invalid query selector ${JSON.stringify(source)}`)
      }
    } else {
      const entries = []
      for (const [name, value] of Object.entries(source)) {
        if (isVariable(value)) {
          entries.push([name, scope[toKey(value)]])
        } else {
          const select = yield* readSelect(value, scope)
          entries.push([name, select])
        }
      }

      return Object.fromEntries(entries)
    }
  } else {
    throw new Error(
      `.select must be an object or a tuple, instead got ${JSON.stringify(
        source
      )}`
    )
  }
}

/**
 * Takes a JSON formatted `.where` clause of the DB query and returns a `where`
 * clause object with variables expected by the database along with extended
 * environment that contains all the referenced variables.
 *
 * @param {unknown} source
 * @param {DB.Variables} scope
 * @returns {Task.Task<DB.Where, Error>}
 */

export const readWhere = function* (source, scope) {
  if (Array.isArray(source)) {
    const where = []
    for (const clause of source) {
      const form = yield* readForm(clause, scope)
      where.push(form)
    }
    return where
  } else {
    throw new Error(
      `Invalid query, 'where' field must be an array of clause, instead got '${source}'`
    )
  }
}

/**
 * Read form simply traverses a JSON `source` and substitutes every variable
 * reference (string starting with `?`) with a corresponding variable from the
 * environment. References to variables that are not in the environment are
 * added to the extended environment which is returned as part of the result.
 *
 * @template T
 * @param {T} source
 * @param {DB.Variables} scope
 * @returns {Task.Task<any, Error>}
 */
export const readForm = function* (source, scope) {
  // If it is a variable we substitute it with an actual variable from the
  // environment.
  if (isVariable(source)) {
    return scope[toKey(source)]
  }
  // If it is an array we recursively process each member of the array.
  else if (Array.isArray(source)) {
    const forms = []
    for (const member of source) {
      const form = yield* readForm(member, scope)
      forms.push(form)
    }
    return forms
  } else if (isReference(source)) {
    return source
  }
  // If it is an object we recursively process each member pair.
  else if (isObject(source)) {
    const entries = []
    for (const [name, value] of Object.entries(source)) {
      const form = yield* readForm(value, scope)
      entries.push([name, form])
    }

    return Object.fromEntries(entries)
  }
  // if it is anything else we just return it as is.
  else {
    return source
  }
}

/**
 *
 * @param {unknown} source
 * @returns {source is object}
 */
const isObject = (source) => source != null && typeof source === 'object'

/**
 * @param {DB.Variable|string} variable
 * @returns
 */
const toKey = (variable) =>
  `$${Var.is(variable) ? Var.id(variable) : variable.slice(1)}`

export default Scope
