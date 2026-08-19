/**
 * Check whether a value is a `Uint8Array`, including one from another realm.
 * @internal
 */
export function isUint8Array(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === '[object Uint8Array]'
  )
}

/**
 * Check whether a value is an `ArrayBuffer`, including one from another realm.
 * @internal
 */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]'
}

/**
 * Check whether a value is a binary body the mock knows how to normalize to bytes.
 * @internal
 */
export function isBinaryBody(value: unknown): value is Uint8Array | ArrayBuffer {
  return isUint8Array(value) || isArrayBuffer(value)
}

/**
 * View a binary value as a `Uint8Array`. A `Uint8Array` (including a `Buffer`)
 * is returned as-is; an `ArrayBuffer` is wrapped. Does not copy.
 * @internal
 */
export function toBytes(value: Uint8Array | ArrayBuffer): Uint8Array {
  return isUint8Array(value) ? value : new Uint8Array(value)
}

/**
 * Compare two byte arrays for exact equality (length then byte-by-byte).
 * @internal
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
