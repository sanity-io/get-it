/**
 * A file/blob entry from a normalized `FormData` body.
 * @internal
 */
export interface NormalizedFile {
  name: string
  type: string
  size: number
  bytes: Uint8Array
}

/** A normalized `FormData` field value. @internal */
export type FormValue = string | NormalizedFile

/**
 * Read a `Blob` (or `File`) fully into a `Uint8Array`.
 * @internal
 */
export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Normalize `URLSearchParams` to a plain record. A single value stays a string;
 * duplicate keys collapse to an array (preserving multi-value params).
 * @internal
 */
export function normalizeUrlSearchParams(
  params: URLSearchParams,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key)
    out[key] = all.length > 1 ? all : all[0]
  }
  return out
}

/**
 * Normalize `FormData` to a plain record. String entries stay strings; `File`
 * entries become `{name, type, size, bytes}`; a field appearing multiple times
 * becomes an array in append order. The multipart boundary is never involved.
 * @internal
 */
export async function normalizeFormData(
  form: FormData,
): Promise<Record<string, FormValue | FormValue[]>> {
  const grouped = new Map<string, FormValue[]>()
  for (const [key, value] of form.entries()) {
    const normalized: FormValue =
      typeof value === 'string'
        ? value
        : {name: value.name, type: value.type, size: value.size, bytes: await blobToBytes(value)}
    const existing = grouped.get(key)
    if (existing) {
      existing.push(normalized)
    } else {
      grouped.set(key, [normalized])
    }
  }
  const out: Record<string, FormValue | FormValue[]> = {}
  for (const [key, values] of grouped) {
    out[key] = values.length > 1 ? values : values[0]
  }
  return out
}

/**
 * Generate a random multipart boundary. The value is arbitrary — assertions
 * should match the `multipart/form-data` prefix, not the boundary.
 * @internal
 */
function randomBoundary(): string {
  return `----MockFetchFormBoundary${Math.random().toString(16).slice(2)}`
}

/**
 * The `Content-Type` the platform `fetch` would set for a given body, or null
 * when the body type has no default. `File` is handled by the `Blob` branch
 * (it extends `Blob`); `FormData`/`URLSearchParams` are not `Blob`s.
 * @internal
 */
export function contentTypeFor(rawBody: unknown): string | null {
  if (rawBody instanceof URLSearchParams) return 'application/x-www-form-urlencoded;charset=UTF-8'
  if (rawBody instanceof FormData) return `multipart/form-data; boundary=${randomBoundary()}`
  if (rawBody instanceof Blob) return rawBody.type === '' ? null : rawBody.type
  return null
}

/**
 * Normalize a handler's expected body to the same canonical form the mock
 * records for the actual request. Native body types are converted; any other
 * value (plain object, asymmetric matcher, string, bytes) passes through
 * unchanged.
 * @internal
 */
export async function normalizeExpectedBody(value: unknown): Promise<unknown> {
  if (value instanceof URLSearchParams) return normalizeUrlSearchParams(value)
  if (value instanceof FormData) return normalizeFormData(value)
  if (value instanceof Blob) return blobToBytes(value)
  return value
}
