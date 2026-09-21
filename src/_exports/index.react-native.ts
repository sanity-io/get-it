import {createRequester as coreCreateRequester} from '../createRequester'
import {wrapReactNativeFetch} from '../reactNativeFetch'
import type {RequesterOptions, RequestFunction, WrappingMiddleware} from '../types'

export * from './index'

/**
 * Creates a requester for React Native, normalizing fetch network failures
 * and restoring abort reasons before the retry middleware handles them.
 * @public
 */
export function createRequester(options: RequesterOptions & {as: 'json'}): RequestFunction<'json'>
/** Creates a requester that returns text responses by default. @public */
export function createRequester(options: RequesterOptions & {as: 'text'}): RequestFunction<'text'>
/** Creates a requester that returns stream responses by default. @public */
export function createRequester(
  options: RequesterOptions & {as: 'stream'},
): RequestFunction<'stream'>
/** Creates a requester that returns buffered responses by default. @public */
export function createRequester(options?: RequesterOptions): RequestFunction
export function createRequester(
  options?: RequesterOptions,
): RequestFunction<'json' | 'text' | 'stream' | undefined> {
  const instanceFetch = options?.fetch
  // Run inside all user middleware so per-request and middleware-supplied
  // fetch overrides are normalized too. Only fetch rejections are caught.
  const normalizeFetch: WrappingMiddleware = (opts, next) =>
    next({
      ...opts,
      fetch: wrapReactNativeFetch(opts.fetch ?? instanceFetch ?? globalThis.fetch),
    })

  return coreCreateRequester({
    ...options,
    middleware: [...(options?.middleware ?? []), normalizeFetch],
  })
}
