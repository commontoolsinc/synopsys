import * as Type from './type.js'

/**
 * @template {string} Segment
 */
class InvalidInput extends RangeError {
  /**
   * @param {Segment} segment
   * @param {unknown} expect
   * @param {unknown} actual
   * @param {unknown} at
   * @param {string} [message]
   */
  constructor(segment, expect, actual, at, message) {
    super(
      message ??
        `Invalid ${segment} encoding, expected ${expect} at ${at} but got ${actual} instead`
    )
    this.InvalidInput = {
      segment,
      expect,
      actual,
      at,
    }
  }
}

/**
 * @template {string} Segment
 */
class IncompleteInput extends RangeError {
  /**
   * @param {Segment} segment
   * @param {string} [message]
   */
  constructor(segment, message) {
    super(message ?? `Incomplete ${segment} sequence`)
    this.IncompleteInput = { segment }
  }
}

/**
 * @template {string} Segment
 * @param {object} source
 * @param {Segment} source.segment
 * @param {string} [source.message]
 * @return {Type.Job<never, Type.IncompleteInput<Segment>>}
 */
export const incomplete = ({ segment, message }) =>
  fail(new IncompleteInput(segment, message))

/**
 * @template {string} Segment
 * @param {object} source
 * @param {Segment} source.segment
 * @param {unknown} source.expect
 * @param {unknown} source.actual
 * @param {unknown} source.at
 * @param {string} [source.message]
 * @return {Type.Job<never, Type.InvalidInput<Segment>>}
 */
export const invalid = ({ segment, expect, actual, at, message }) =>
  fail(new InvalidInput(segment, expect, actual, at, message))

/**
 * @template {globalThis.Error} Error
 * @param {Error} error
 * @return {Type.Job<never, Type.Throw<Error>>}
 */
export function* fail(error) {
  if (error instanceof Error) {
    throw error
  } else {
    throw Object.assign(new Error('Generic failure'), error)
  }
}

export { fail as throw }
