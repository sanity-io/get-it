import type {BufferedResponse} from './types'

const decoder = new TextDecoder()

/** @public */
export function createBufferedResponse(
  status: number,
  statusText: string,
  headers: Headers,
  body: Uint8Array,
): BufferedResponse {
  let cachedText: string | undefined

  return {
    status,
    statusText,
    headers,
    body,

    text(): string {
      if (cachedText === undefined) {
        cachedText = decoder.decode(body)
      }
      return cachedText
    },

    json(): unknown {
      return JSON.parse(this.text())
    },

    bytes(): Uint8Array {
      return body
    },
  }
}
