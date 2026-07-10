/**
 * Check whether a value is a binary body the mock knows how to normalize to bytes.
 * @internal
 */
export function isBinaryBody(value: unknown): value is Uint8Array | ArrayBuffer {
  return value instanceof Uint8Array || value instanceof ArrayBuffer
}

/**
 * View a binary value as a `Uint8Array`. A `Uint8Array` (including a `Buffer`)
 * is returned as-is; an `ArrayBuffer` is wrapped. Does not copy.
 * @internal
 */
export function toBytes(value: Uint8Array | ArrayBuffer): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value)
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
