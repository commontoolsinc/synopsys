import { Task } from 'datalogia'

/**
 * @template {unknown} Ok
 * @template {Error} Fail
 * @typedef {Task.Task<Ok, Error>} Task
 */

export const { wait, fail, spawn, perform, fork, suspend } = Task

/**
 * Takes a {@link Task.Result} value and returns a task that return `ok` value of
 * the successful result or throws the `error` of the failed result.
 *
 * @template {{}} Ok
 * @template {{}} Fail
 * @param {Ok} value
 * @returns {Task.Task<Ok, Fail>}
 */
export const ok = (value) => Task.ok({ ok: value })
