import {Agent, EnvHttpProxyAgent, ProxyAgent} from 'undici'
import type Dispatcher from 'undici/types/dispatcher'

import type {FetchFunction, FetchInit, FetchResponse} from '../types'

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
 * Node's `globalThis.fetch` is powered by undici and accepts a `dispatcher`
 * property in its init object, but TypeScript's `RequestInit` doesn't
 * include it. This interface extends `RequestInit` to declare that property.
 */
interface NodeRequestInit extends RequestInit {
  dispatcher?: Dispatcher
}

/**
 * Adapts a standard `Response` (from globalThis.fetch) into our
 * `FetchResponse` interface. This avoids type assertions by explicitly
 * mapping the structural overlap.
 */
function adaptResponse(response: Response): FetchResponse {
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

/**
 * A typed reference to `globalThis.fetch` that accepts `NodeRequestInit`,
 * which includes the `dispatcher` property.
 *
 * This works because Node's built-in fetch (undici) does accept `dispatcher`
 * at runtime — we just need to widen the init type.
 */
const nodeFetchFn: (input: string, init?: NodeRequestInit) => Promise<Response> = globalThis.fetch

/**
 * Creates a `FetchFunction` backed by an undici dispatcher.
 *
 * - `proxy: true` (default) — uses `EnvHttpProxyAgent` which reads
 *   `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` from the environment.
 * - `proxy: "<url>"` — uses `ProxyAgent` with an explicit proxy URL.
 * - `proxy: false` — uses a plain `Agent` with no proxy.
 * @public
 */
export function nodeFetch(options?: NodeFetchOptions): FetchFunction {
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

  return (input: string, init?: FetchInit): Promise<FetchResponse> => {
    const nodeInit: NodeRequestInit = {
      method: init?.method,
      headers: init?.headers,
      signal: init?.signal,
      redirect: init?.redirect,
      dispatcher,
    }
    // Only set body when it's defined — globalThis.fetch throws on
    // `body: undefined` for some request methods in strict mode.
    if (init?.body !== undefined) {
      nodeInit.body = init.body
    }
    return nodeFetchFn(input, nodeInit).then(adaptResponse)
  }
}
