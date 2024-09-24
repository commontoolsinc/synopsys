import * as DB from 'datalogia'
import * as Task from './task.js'

/**
 * @template {DB.API.Selector} [Select=DB.API.Selector]
 * @typedef {object} Query
 * @property {Select} source.select
 * @property {Iterable<DB.API.Clause>} source.where
 */

/**
 * Takes JSON formatted query and return a query object with variables
 * expected by the database.
 *
 * @param {unknown} source
 * @returns {Task.Task<Query, Error>}
 */

export const fromJSON = function* (source) {
  const { select, env } = yield* readSelect(
    /** @type {{select?:unknown}} */ (source)?.select ?? {},
    Object.create(null)
  )

  const { where } = yield* readWhere(
    /** @type {{where?:unknown}} */ (source)?.where,
    env
  )

  return { select, where }
}

/**
 * @param {unknown} source
 * @returns {source is `?${string}`}
 */
const isVariable = (source) =>
  typeof source === 'string' && source.startsWith('?')

/**
 * Takes JSON formatted `.select` clause of the DB query and returns a `select`
 * clause object with variables expected by the database along with extended
 * environment that contains all the referenced variables.
 *
 * @param {unknown} source
 * @param {DB.Variables} env
 * @returns {Task.Task<{select: DB.API.Selector, env: DB.Variables}, Error>}
 */

export const readSelect = function* (source, env) {
  if (source && typeof source === 'object') {
    if (Array.isArray(source)) {
      const [variable] = source
      if (isVariable(variable)) {
        const vars = withVariable(env, variable)
        return yield* Task.ok({
          /** @type {DB.API.Selector} */
          select: [vars[variable]],
          env: vars,
        })
      } else {
        return yield* Task.fail(
          new Error(`Invalid query selector ${JSON.stringify(source)}`)
        )
      }
    } else {
      const entries = []
      let vars = env
      for (const [name, value] of Object.entries(source)) {
        if (isVariable(value)) {
          vars = withVariable(vars, value)
          entries.push([name, vars[value]])
        } else {
          const { select, env } = yield* readSelect(value, vars)
          entries.push([name, select])
          vars = env
        }
      }

      return yield* Task.ok({ select: Object.fromEntries(entries), env: vars })
    }
  } else {
    return yield* Task.fail(
      new Error(
        `.select must be an object or a tuple, instead got ${JSON.stringify(
          source
        )}`
      )
    )
  }
}

/**
 * Takes a JSON formatted `.where` clause of the DB query and returns a `where`
 * clause object with variables expected by the database along with extended
 * environment that contains all the referenced variables.
 *
 * @param {unknown} source
 * @param {DB.Variables} env
 * @returns {Task.Task<{where: DB.API.Clause[], env: DB.API.Variables}, Error>}
 */

export const readWhere = function* (source, env) {
  let vars = env
  if (Array.isArray(source)) {
    const where = []
    for (const clause of source) {
      const { form, env } = yield* readForm(clause, vars)
      where.push(form)
      vars = env
    }
    return yield* Task.ok({ where, env: vars })
  } else {
    return yield* Task.fail(
      new Error(
        `.where must be an array of clause, instead got ${JSON.stringify(
          source
        )}`
      )
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
 * @param {DB.Variables} env
 * @returns {Task.Task<{form: any, env: DB.Variables}, Error>}
 */
export const readForm = function* (source, env) {
  let vars = env
  // If it is a variable we substitute it with an actual variable from the
  // environment.
  if (isVariable(source)) {
    vars = withVariable(vars, source)
    return yield* Task.ok({ form: vars[source], env: vars })
  }
  // If it is an array we recursively process each member of the array.
  else if (Array.isArray(source)) {
    const forms = []
    for (const member of source) {
      const { form, env } = yield* readForm(member, vars)
      forms.push(form)
      vars = env
    }
    return yield* Task.ok({ form: forms, env: vars })
  }
  // If it is an object we recursively process each member pair.
  else if (isObject(source)) {
    const entries = []
    for (const [name, value] of Object.entries(source)) {
      const { form, env } = yield* readForm(value, vars)
      entries.push([name, form])
      vars = env
    }

    return { form: Object.fromEntries(entries), env: vars }
  }
  // if it is anything else we just return it as is.
  else {
    return yield* Task.ok({ form: source, env: vars })
  }
}

/**
 *
 * @param {unknown} source
 * @returns {source is object}
 */
const isObject = (source) => source != null && typeof source === 'object'

/**
 * @template {`?${string}`} Var
 * @template {DB.Variables} Env
 * @param {Env} env
 * @param {Var} variable
 * @returns {Env & {[key in Var]: DB.API.Variable}}
 */
export const withVariable = (env, variable) =>
  env[variable] ? env : { ...env, [variable]: DB.variable() }
