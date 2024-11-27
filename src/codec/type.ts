import type { Scalar, Result, Variant, API } from '../replica/type.js'
export * from '../replica/type.js'
import * as Task from 'datalogia/task'

export { Scalar, Result }

export interface Encoder<In, Out = Uint8Array, Info = number> {
  encode(source: In): Generator<Out, Info>
}

export interface Decoder<Out, In> {
  decode(source: In): Job<Out, DecodeError>
}

export interface From<
  Type extends { Self: {}; From: unknown; Error: globalThis.Error },
> {
  from(source: Type['From']): Result<Type['Self'], Type['Error']>['ok'] & {}
}

export type ErrorVariant<U extends Record<string, unknown>> = Error & Variant<U>
export type DecodeError = IncompleteInput | InvalidInput

export type Case<T extends Record<string, unknown>> = {
  [Name in string]: Name extends keyof T ? T[Name] : never
}

export type Throw<T extends Record<string, unknown>> = Error & {
  [Name in string]: never
} & { [Name in keyof T]: T[Name] }

export type IncompleteInput<Segment extends string = string> = Throw<{
  IncompleteInput: { segment: Segment }
}>

export type InvalidInput<Segment extends string = string> = Throw<{
  InvalidInput: {
    segment: Segment
    expect: unknown
    actual: unknown
    at: unknown
  }
}>

export interface Decode<Out extends {}, In = Uint8Array>
  extends From<{ Self: Out; From: In; Error: DecodeError }> {}

export type Uint8 = number

export interface BufferCursor {
  at(offset: number): Uint8 | undefined

  byteOffset: number
}

export interface BufferReader extends BufferCursor {
  read(size: number): Uint8Array | undefined
  take(): Uint8 | undefined

  /**
   * Provides a way to do bunch of reads in a transactional manner,
   * if operation fails, it will rollback buffer to the previous offset.
   */
  do<Ok, Throw extends globalThis.Error>(
    read: (buffer: BufferReader) => Job<Ok, Throw>
  ): Job<Ok, Throw>
}

export interface Job<Ok, Effect> {
  [Symbol.iterator](): Execution<Ok, Effect>
}

export interface Execution<Ok extends unknown, Effect> {
  throw(error: Task.InferError<Effect>): IteratorResult<Effect, Ok>
  return(ok: Ok): IteratorResult<Effect, Ok>
  next(): IteratorResult<Effect, Ok>
  [Symbol.iterator](): Execution<Ok, Effect>
}

export interface Repeat<State extends unknown[]> {
  loop: State
}
