import type {Middleware, MiddlewareHooks, MiddlewareResponse} from '../types'

/** @public */
export function injectResponse(
  opts: {
    inject: (
      event: Parameters<MiddlewareHooks['interceptRequest']>[1],
      prevValue: Parameters<MiddlewareHooks['interceptRequest']>[0],
    ) => Partial<MiddlewareResponse | undefined | void>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = {} as any,
) {
  if (typeof opts.inject !== 'function') {
    throw new Error('`injectResponse` middleware requires a `inject` function')
  }

  const inject = function inject(prevValue, event) {
    const response = opts.inject(event, prevValue)
    if (!response) {
      return prevValue
    }

    // Merge defaults so we don't have to provide the most basic of details unless we want to
    const options = event.context.options
    return {
      body: '',
      url: options.url,
      method: options.method!,
      headers: {},
      statusCode: 200,
      statusMessage: 'OK',
      ...response,
    } satisfies MiddlewareResponse
  } satisfies Middleware['interceptRequest']

  return {interceptRequest: inject} satisfies Middleware
}
