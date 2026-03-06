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
  let cachedJson: {value: unknown} | undefined

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
      if (cachedJson === undefined) {
        cachedJson = {value: JSON.parse(this.text())}
      }
      return cachedJson.value
    },

    bytes(): Uint8Array {
      return body
    },
  }
}
