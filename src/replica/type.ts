export type {
  ByteView,
  API,
  query,
  Selector,
  Query,
  Querier,
  Transactor,
  Transaction,
  InferBindings as Selection,
  Result,
  Variant,
  Fact,
  Variable,
  Attribute,
  Instantiation as Import,
} from 'datalogia'
export type { BlockEncoder, BlockDecoder } from 'multiformats'
export type { Task } from 'datalogia/task'

import type {
  Selector,
  InferBindings as Selection,
  Transaction,
  Query,
  Variable,
  API,
} from 'datalogia'
import type { Invocation, Task } from 'datalogia/task'
import type { Commit, Database as Store } from '../store/okra.js'
import { Phantom } from 'multiformats'

export type Constant = API.Constant

export { Store, Commit }
export type Revision = { id: string }

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
 * Represents a session with a local or a remote database.
 */

export interface Session {
  subscribe<Select extends Selector>(
    query: Query<Select>
  ): Task<Subscription<Select>, Error>

  transact(changes: Transaction): Task<Commit, Error>
}

/**
 * Represents database replica either local or a remote.
 */
export interface Replica extends Session {}

export interface Subscription<Select extends Selector = Selector>
  extends BroadcastStream<Selection<Select>[]> {}

export interface BroadcastStream<T> {
  /**
   * Creates a readable stream that will receive data from the underlying
   * stream from the point of forking.
   *
   * When all the forks are closed the underlying source stream will be
   * canceled.
   */
  fork(): ReadableStream<T>
  /**
   * Aborts this stream and closes all of its forks.
   */
  abort(reason: Error): void

  /**
   * A promise that resolves when this stream is closed.
   */
  closed: Promise<undefined>
}

export interface Channel<T, Abort extends Error>
  extends Reader<T, Abort>,
    Writer<T, Abort> {}
export interface Reader<T, Abort extends Error> {
  read(): Invocation<T, Abort>
}
export interface Writer<T, Abort extends Error> {
  write(value: T): void
  cancel(reason?: Abort): void
}

export interface Scope extends Record<PropertyKey, Variable<any>> {
  new (): Scope
  (): Scope
}
