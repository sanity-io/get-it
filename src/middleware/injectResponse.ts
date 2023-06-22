import type {Middleware} from '../types'

/** @public */
export function injectResponse(opts: any = {}) {
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
    return Object.assign(
      {},
      {
        body: '',
        url: options.url,
        method: options.method,
        headers: {},
        statusCode: 200,
        statusMessage: 'OK',
      },
      response
    )
  } satisfies Middleware['interceptRequest']

  return {interceptRequest: inject} satisfies Middleware
}
