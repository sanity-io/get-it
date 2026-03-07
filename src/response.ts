import type {BufferedResponse} from './types'

let decoder: InstanceType<typeof TextDecoder>

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
