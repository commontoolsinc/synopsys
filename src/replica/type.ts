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
  Fact,
  Variable,
  Attribute,
  Instantiation as Import,
  Where,
} from 'datalogia'
export type { BlockEncoder, BlockDecoder } from 'multiformats'
export type { Task } from 'datalogia/task'
export * from '../store/type.js'
export type {
  StoreReader,
  StoreWriter,
  DataBase,
  DataProvider,
  Store,
} from '../store/type.js'
import type {
  Selector,
  InferBindings as Selection,
  Query,
  Variable,
  API,
  Instantiation as Import,
  Fact,
  Variant,
  Result,
} from 'datalogia'
import type { DataBase, DataProvider } from '../store/type.js'
import type { Invocation, Task } from 'datalogia/task'
import type { Commit } from '../source/store.js'
import { Phantom } from 'multiformats'

export type Constant = API.Constant

export { Commit }
export type Revision = { id: string }

export interface BlobReader {
  get(key: string): Task<Blob, Error>
}
export interface BlobWriter {
  put(key: string, blob: Blob): Task<{}, Error>
}

export interface BlobStore extends BlobReader, BlobWriter {}
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

export interface Session extends DataBase {
  subscribe<Select extends Selector>(
    query: Query<Select>
  ): Task<Subscription<Select>, Error>
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
  abort(reason?: Error): void

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

// We extends instruction by adding `Upsert` which overrides the previous
// assertion.
export type Instruction = Variant<{
  Assert: Fact
  Upsert: Fact
  Retract: Fact
  Import: Import
}>

// We also override the `Transaction` so it uses our extended `Instruction` set.
export interface Transaction extends Iterable<Instruction> {}

export interface IterationFinished extends RangeError {
  name: 'IterationFinished'
}

export interface Sequence<T> {
  next(): Task<Result<T, IterationFinished>, Error>
}
