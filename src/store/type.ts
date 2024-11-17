import { Task, Invocation } from 'datalogia/task'
import type {
  Node,
  Bound,
  Entry,
  Key,
  Awaitable,
  ReadOnlyTransaction,
  ReadWriteTransaction,
  Metadata,
} from '@canvas-js/okra'

import type {
  FactsSelector,
  Datum,
  Transactor,
  Querier,
  Query,
  InferBindings as Selection,
  Selector,
} from 'datalogia'
import { Transaction, Commit, Revision, Instruction } from '../replica/type.js'
export * from '../replica/type.js'

export type {
  Entry,
  Bound,
  Awaitable,
  ReadOnlyTransaction,
  ReadWriteTransaction,
  FactsSelector,
  Datum,
  Transaction,
  Commit,
  Node,
  Key,
}

export interface AwaitIterable<T> {
  poll(): Task<IteratorResult<T>, Error>
  next(): Awaitable<IteratorResult<T>>
}

export interface PullSource {
  getRoot(): Task<Node, Error>
  getNode(level: number, key: Key): Task<Node | null, Error>

  getChildren(level: number, key: Uint8Array): Task<Node[], Error>
}

export interface PullTarget extends PullSource {
  nodes(
    level: number,
    lowerBound?: Bound<Key> | null,
    upperBound?: Bound<Key> | null,
    options?: { reverse?: boolean }
  ): AwaitIterable<Node>
}

export interface NodeStore extends PullSource, PullTarget {
  readonly metadata: Metadata

  setNode(node: Node): Task<void, Error>
  deleteNode(level: number, key: Key): Task<void, Error>
}

/**
 * Represents a data index reader interface.
 */
export interface StoreReader extends PullSource, PullTarget {
  entries(
    lowerBound?: Bound<Uint8Array> | null,
    upperBound?: Bound<Uint8Array> | null,
    options?: {
      reverse?: boolean
    }
  ): AwaitIterable<Entry>

  get(key: Uint8Array): Task<Uint8Array | null, Error>
}

export interface StoreWriter {
  delete(key: Uint8Array): Task<{}, Error>
  set(key: Uint8Array, value: Uint8Array): Task<{}, Error>

  integrate(changes: Change[]): Task<Node, Error>
}

export interface StoreEditor extends StoreReader, StoreWriter {}

export interface Store {
  read<T, X extends Error>(
    read: (reader: StoreReader) => Task<T, X>
  ): Task<T, X>
  write<T, X extends Error>(
    write: (editor: StoreEditor) => Task<T, X>
  ): Task<T, X>

  close(): Task<{}>
}

export interface AsyncReader {
  getRoot(): Promise<Node>
  getNode(level: number, key: Uint8Array): Promise<Node | null>
  getChildren(level: number, key: Uint8Array): Promise<Node[]>

  get(key: Uint8Array): Promise<Uint8Array | null>
  set(key: Uint8Array, value: Uint8Array): Promise<void>
  delete(key: Uint8Array): Promise<void>
  entries(
    lowerBound?: Bound<Uint8Array> | null,
    upperBound?: Bound<Uint8Array> | null,
    options?: { reverse?: boolean | undefined }
  ): AsyncIterableIterator<[Uint8Array, Uint8Array]>
  nodes(
    level: number,
    lowerBound?: Bound<Key> | null,
    upperBound?: Bound<Key> | null,
    options?: {
      reverse?: boolean
    }
  ): AsyncIterableIterator<Node>

  close?: () => Awaitable<void>
}

export interface DataProvider {
  scan(selector: FactsSelector): Task<Datum[], Error>
}

export interface DataCommitter {
  transact(changes: Iterable<Instruction>): Task<Commit, Error>
}

export interface Resource {
  close(): Task<{}, Error>
}

export interface DataSource extends Resource, DataProvider, DataCommitter {}

export interface DataSelector {
  query<Select extends Selector>(
    query: Query<Select>
  ): Task<Selection<Select>[], Error>
}

export interface DataBase extends Resource, DataCommitter, DataSelector {}

export type Change = Assign | Remove

export type Assign = [key: Uint8Array, value: Uint8Array]
export type Remove = [key: Uint8Array]

export interface PushTarget {
  integrate(changes: Change[]): Task<Node, Error>
}

export interface SynchronizationSource extends PullSource, PushTarget {}

export interface DataRepository extends DataSource {
  store: Store
}
