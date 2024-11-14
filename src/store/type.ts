import { Task, Invocation } from 'datalogia/task'
import type {
  Node,
  Bound,
  Entry,
  Key,
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
  Node,
  Key,
}

export interface AwaitIterable<T> {
  next(): Awaitable<IteratorResult<T>>
}

export interface Reader {
  getRoot(): Task<Node>
  getNode(level: number, key: Uint8Array): Task<Node | null>
  getChildren(level: number, key: Uint8Array): Task<Node[]>

  entries(
    lowerBound?: Bound<Uint8Array> | null,
    upperBound?: Bound<Uint8Array> | null,
    options?: {
      reverse?: boolean
    }
  ): AwaitIterable<Entry>

  nodes(
    level: number,
    lowerBound?: Bound<Key> | null,
    upperBound?: Bound<Key> | null,
    options?: {
      reverse?: boolean
    }
  ): AwaitIterable<Node>

  get(key: Uint8Array): Task<Uint8Array | null>
}

export interface Writer {
  delete(key: Uint8Array): Task<void>
  set(key: Uint8Array, value: Uint8Array): Task<void>

  integrate(changes: Change[]): Task<Node>
}

export interface Editor extends Reader, Writer {}

export interface Store {
  read<T, X extends Error>(read: (reader: Reader) => Task<T, X>): Task<T, X>
  write<T, X extends Error>(write: (editor: Editor) => Task<T, X>): Task<T, X>

  close(): Task<void>
}

export interface AsyncSource {
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

export interface Database {
  store: Store

  scan(selector: FactsSelector): Task<Datum[], Error>
  transact(charges: Transaction): Task<Commit, Error>
  status(): Task<Revision, Error>

  close(): Task<{}, Error>
}

export interface Root {
  level: number
  key: Uint8Array

  hash: Uint8Array
}

export type Change = Assign | Remove

export type Assign = [key: Uint8Array, value: Uint8Array]
export type Remove = [key: Uint8Array]

export interface PullSource {
  getRoot(): Task<Node, Error>
  getNode(level: number, key: Uint8Array): Task<Node | null, Error>

  getChildren(level: number, key: Uint8Array): Task<Node[], Error>
}

export interface PushSource {
  integrate(changes: Change[]): Task<Node, Error>
}

export interface SynchronizationSource extends PullSource, PushSource {}
