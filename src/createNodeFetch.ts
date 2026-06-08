import {Agent, EnvHttpProxyAgent, fetch as undiciFetch, ProxyAgent} from 'undici'
import type Dispatcher from 'undici/types/dispatcher'

import type {FetchFunction, FetchInit, FetchResponse} from './types'

/**
 * TLS configuration for mutual TLS (client certificates).
 *
 * @public
 */
export interface TlsOptions {
  /** Client certificate (PEM-encoded) */
  cert?: string | Buffer
  /** Client private key (PEM-encoded) */
  key?: string | Buffer
  /** Certificate authority (PEM-encoded) — use for self-signed server certs */
  ca?: string | Buffer
}

/**
 * Options for {@link createNodeFetch}.
 *
 * @public
 */
export interface NodeFetchOptions {
  /** true = read proxy from env (default), string = explicit proxy URL, false = no proxy */
  proxy?: string | boolean
  /** Maximum number of connections per origin */
  connections?: number
  /**
   * Enable HTTP/2 support. Defaults to `false` (HTTP/1.1 only). We opt out
   * unless explicitly enabled so the transport stays predictable across
   * undici versions regardless of their default negotiation behavior.
   */
  allowH2?: boolean
  /** TLS options for mutual TLS (client certificates) */
  tls?: TlsOptions
}

/**
 * Creates a `FetchFunction` backed by an undici dispatcher.
 *
 * - `proxy: true` (default) — uses `EnvHttpProxyAgent` which reads
 *   `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` from the environment.
 * - `proxy: "<url>"` — uses `ProxyAgent` with an explicit proxy URL.
 * - `proxy: false` — uses a plain `Agent` with no proxy.
 * @public
 */
export function createNodeFetch(options?: NodeFetchOptions): FetchFunction {
  const proxyOption = options?.proxy ?? true

  let dispatcher: Dispatcher

  const tls = options?.tls
  // Default to HTTP/1.1-only; opt into HTTP/2 only when explicitly enabled so
  // the transport stays predictable regardless of undici's default negotiation.
  const allowH2 = options?.allowH2 ?? false

  if (proxyOption === true) {
    dispatcher = new EnvHttpProxyAgent({
      connections: options?.connections,
      allowH2,
      requestTls: tls ? {cert: tls.cert, key: tls.key, ca: tls.ca} : undefined,
    })
  } else if (typeof proxyOption === 'string') {
    dispatcher = new ProxyAgent({
      uri: proxyOption,
      connections: options?.connections,
      allowH2,
      requestTls: tls ? {cert: tls.cert, key: tls.key, ca: tls.ca} : undefined,
    })
  } else {
    dispatcher = new Agent({
      connections: options?.connections,
      allowH2,
      connect: tls ? {cert: tls.cert, key: tls.key, ca: tls.ca} : undefined,
    })
  }

  // Streamed request bodies require `duplex: 'half'` in undici/Node —
  // omitting it throws "duplex option is required when sending a body".
  // Typed explicitly so the literal isn't widened to `string`.
  const halfDuplex: {duplex: 'half'} = {duplex: 'half'}

  return async function nodeFetch(input: string, reqInit?: FetchInit): Promise<FetchResponse> {
    const {body, ...rest} = reqInit ?? {}
    const init = {
      ...rest,
      dispatcher,
      // Only set body when it's defined — fetch _can_ throw on
      // `body: undefined` for some request methods in strict mode.
      ...(body === undefined ? {} : {body}),
      ...(body instanceof ReadableStream ? halfDuplex : {}),
    }
    const response = await undiciFetch(input, init)
    return adaptResponse(response)
  }
}

/**
 * The subset of Response properties we actually use. Typed structurally to
 * avoid coupling to undici's `Response` type and any version skew between
 * undici and the `undici-types` bundled by @types/node.
 */
interface FetchResponseLike {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  url: string
  redirected: boolean
  body: ReadableStream<Uint8Array> | null
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

/**
 * Adapts a fetch `Response` into our `FetchResponse` interface.
 */
function adaptResponse(response: FetchResponseLike): FetchResponse {
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    url: response.url,
    redirected: response.redirected,
    body: response.body,
    text: () => response.text(),
    arrayBuffer: () => response.arrayBuffer(),
  }
}
