import {Agent, EnvHttpProxyAgent, fetch as undiciFetch, ProxyAgent} from 'undici'
import type Dispatcher from 'undici/types/dispatcher'

import type {FetchFunction, FetchInit, FetchResponse} from './types'

/** @public */
export interface TlsOptions {
  /** Client certificate (PEM-encoded) */
  cert?: string | Buffer
  /** Client private key (PEM-encoded) */
  key?: string | Buffer
  /** Certificate authority (PEM-encoded) — use for self-signed server certs */
  ca?: string | Buffer
}

/** @public */
export interface NodeFetchOptions {
  /** true = read proxy from env (default), string = explicit proxy URL, false = no proxy */
  proxy?: string | boolean
  /** Maximum number of connections per origin */
  connections?: number
  /** Enable HTTP/2 support */
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

  if (proxyOption === true) {
    dispatcher = new EnvHttpProxyAgent({
      connections: options?.connections,
      allowH2: options?.allowH2,
      requestTls: tls ? {cert: tls.cert, key: tls.key, ca: tls.ca} : undefined,
    })
  } else if (typeof proxyOption === 'string') {
    dispatcher = new ProxyAgent({
      uri: proxyOption,
      connections: options?.connections,
      allowH2: options?.allowH2,
      requestTls: tls ? {cert: tls.cert, key: tls.key, ca: tls.ca} : undefined,
    })
  } else {
    dispatcher = new Agent({
      connections: options?.connections,
      allowH2: options?.allowH2,
      connect: tls ? {cert: tls.cert, key: tls.key, ca: tls.ca} : undefined,
    })
  }

  return async function nodeFetch(input: string, reqInit?: FetchInit): Promise<FetchResponse> {
    const {body, ...rest} = reqInit ?? {}
    const init = {
      ...rest,
      dispatcher,
      // Only set body when it's defined — fetch _can_ throw on
      // `body: undefined` for some request methods in strict mode.
      ...(body === undefined ? {} : {body}),
    }
    const response = await undiciFetch(input, init)
    return adaptResponse(response)
  }
}

/**
 * The subset of Response properties we actually use. Typed structurally to
 * avoid the undici@7 / undici-types@6.21 version conflict in @types/node.
 */
interface FetchResponseLike {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
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
    body: response.body,
    text: () => response.text(),
    arrayBuffer: () => response.arrayBuffer(),
  }
}
