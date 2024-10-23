export type {
  ByteView,
  API,
  query,
  Selector,
  Query,
  Querier,
  Transactor,
  InferBindings as Selection,
  Result,
  Variant,
  Variable,
} from 'datalogia'
export type { BlockEncoder, BlockDecoder } from 'multiformats'
export type { Task } from 'datalogia/task'

import type {
  Selector,
  InferBindings as Selection,
  Transaction,
  Query,
} from 'datalogia'
import type { Invocation, Task } from 'datalogia/task'
import type { Commit, Database as Store } from '../store/okra.js'
import { Phantom } from 'multiformats'

export { Store, Commit }

/**
 * A directed acyclic graph.
 */
export type DAG = {} | null

export interface Reference<T extends null | {} = null | {}> extends Phantom<T> {
  toJSON(): { '/': string }
  toString(): string
  readonly ['/']: Uint8Array
}

/**
 * Represents an agent session with a local or a remote database.
 */

export interface Session {
  subscribe<Select extends Selector>(
    query: Query<Select>
  ): Task<Subscription<Select>, Error>

  transact(changes: Transaction): Task<Commit, Error>
}

export interface Subscription<Select extends Selector = Selector>
  extends ReadableStream<Selection<Select>[]> {
  query: Query<Select>

  poll(): Task<Selection<Select>[], Error>
}

export interface SignalController<T> {
  send(value: T): void
  abort(reason: Error): void
}

export interface PromiseController<T> extends SignalController<T> {
  promise: Promise<T>
}
