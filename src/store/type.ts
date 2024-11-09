import { Task } from 'datalogia/task'
import type {
  Node,
  Bound,
  Entry,
  Awaitable,
  ReadOnlyTransaction,
  ReadWriteTransaction,
} from '@canvas-js/okra'

import type { FactsSelector, Datum } from 'datalogia'
import { Transaction, Commit, Revision } from '../replica/type.js'
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
}

export interface EntryRange {
  next(): Awaitable<IteratorResult<Entry>>
}

export interface Reader {
  getRoot(): Task<Node>

  entries(
    lowerBound?: Bound<Uint8Array> | null,
    upperBound?: Bound<Uint8Array> | null,
    options?: {
      reverse?: boolean
    }
  ): EntryRange

  get(key: Uint8Array): Task<Uint8Array | null>
}

export interface Writer extends Reader {
  delete(key: Uint8Array): Task<void>
  set(key: Uint8Array, value: Uint8Array): Task<void>
}

export interface Store {
  read<T>(read: (reader: Reader) => Task<T>): Task<T>
  write<T>(write: (writer: Writer) => Task<T>): Task<T>

  close(): Task<void>
}

export interface AsyncSource {
  getRoot(): Promise<Node>
  get(key: Uint8Array): Promise<Uint8Array | null>
  set(key: Uint8Array, value: Uint8Array): Promise<void>
  delete(key: Uint8Array): Promise<void>
  entries(
    lowerBound?: Bound<Uint8Array> | null,
    upperBound?: Bound<Uint8Array> | null,
    options?: { reverse?: boolean | undefined }
  ): AsyncIterableIterator<[Uint8Array, Uint8Array]>

  close?: () => Awaitable<void>
}

export interface Database {
  scan(selector: FactsSelector): Task<Datum[], Error>
  transact(charges: Transaction): Task<Commit, Error>
  status(): Task<Revision, Error>

  close(): Task<{}, Error>
}
