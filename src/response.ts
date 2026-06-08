import type {BufferedResponse} from './types'

let decoder: InstanceType<typeof TextDecoder>

/**
 * Creates a {@link BufferedResponse} from raw response parts. Text and JSON
 * decoding are lazy and cached — the body bytes are only decoded on first access.
 *
 * @param status - HTTP status code.
 * @param statusText - HTTP status text.
 * @param headers - Response headers.
 * @param body - Raw response body bytes.
 * @returns A buffered response with `text()`, `json()`, and `bytes()` accessors.
 *
 * @internal
 */
export function createBufferedResponse(
  status: number,
  statusText: string,
  headers: Headers,
  body: Uint8Array,
): BufferedResponse {
  let cachedText: string | undefined
  let cachedJson: {value: unknown} | undefined

  return {
    status,
    statusText,
    headers,
    body,

    text(): string {
      return (cachedText ??= (decoder ??= new TextDecoder()).decode(body))
    },

    json(): unknown {
      return (cachedJson ??= {value: JSON.parse(this.text())}).value
    },

    bytes(): Uint8Array {
      return body
    },
  }
}
