import * as Type from '../type.js'

class Variable {
  #name
  /**
   * @param {number} id
   * @param {string|symbol} name
   */
  constructor(id, name = Symbol()) {
    this['?'] = { id }
    this.#name = name
  }
  get id() {
    return this['?'].id
  }
  toString() {
    return typeof this.#name === 'symbol'
      ? `?@${this.#name.description ?? this.id}`
      : `?${this.#name.toString()}`
  }
  get [Symbol.toStringTag]() {
    return this.toString()
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString()
  }
}

class Scope {
  /**
   * @param {Map<string|symbol, Type.Variable<any>>} [vars]
   * @returns {Type.Scope}
   */
  static new(vars = new Map()) {
    const scope = /** @type {Type.Scope} */ (
      new Proxy(
        /** @type {any} */ (Object.assign(function () {}, { vars })),
        Scope
      )
    )

    return scope
  }

  /**
   * @param {{vars: Map<string|symbol, Type.Variable<any>>}} scope
   * @param {string|symbol} key
   */
  static get({ vars }, key) {
    const variable = vars.get(key)
    if (variable) {
      return variable
    } else {
      const variable = new Variable(vars.size + 1, key)
      vars.set(key, variable)
      return variable
    }
  }
  /**
   * @param {{vars: Map<string|symbol, Type.Variable<any>>}} scope
   * @param {string|symbol} key
   */
  static has({ vars }, key) {
    return vars.has(key)
  }

  /**
   * @param {{vars: Map<string|symbol, Type.Variable<any>>}} env
   */
  static ownKeys({ vars }) {
    const keys = [...vars.keys()]
    if (!keys.includes('prototype')) {
      keys.push('prototype')
    }
    return keys
  }

  /**
   * @returns {Type.Scope}
   */
  static construct() {
    return Scope.new()
  }

  /**
   @param {{vars: Map<string|symbol, Type.Variable<any>>}} scope
   * @returns {Type.Scope}
   */
  static apply({ vars }) {
    return Scope.new(new Map(vars))
  }
}

const global = Scope.new()
export default global

/**
 * @param {string|symbol} [name]
 */
export const variable = (name = Symbol()) => global[name]
