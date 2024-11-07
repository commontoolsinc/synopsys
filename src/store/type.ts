import { Task } from 'datalogia/task'
import {
  Node,
  Bound,
  Entry,
  Awaitable,
  ReadOnlyTransaction,
  ReadWriteTransaction,
} from '@canvas-js/okra'
export * from '../replica/type.js'

export type {
  Entry,
  Bound,
  Awaitable,
  ReadOnlyTransaction,
  ReadWriteTransaction,
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
