export interface DecodeResult {
  value: number
  nextIndex: number
}

export declare function decodeInt32(
  data: Uint8Array,
  offset: number
): DecodeResult

export declare function decodeInt64(
  data: Uint8Array,
  offset: number
): DecodeResult

export declare function encodeUInt64(value: bigint): Uint8Array

export declare function encodeUInt32(value: number): Uint8Array
