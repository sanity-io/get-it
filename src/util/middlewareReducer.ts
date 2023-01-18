import type {MiddlewareReducer, ProcessedRequestOptions, RequestOptions} from '../types'

export function middlewareReducer(
  middleware: MiddlewareReducer
): (hook: 'processOptions', defaultValue: string | RequestOptions) => ProcessedRequestOptions
export function middlewareReducer(
  middleware: MiddlewareReducer
): (hook: 'validateOptions', defaultValue: ProcessedRequestOptions) => void
export function middlewareReducer(middleware: MiddlewareReducer) {
  const applyMiddleware = (
    hook: keyof MiddlewareReducer,
    defaultValue: unknown,
    ...args: unknown[]
  ): any => {
    const bailEarly = hook === 'onError'

    let value = defaultValue
    for (let i = 0; i < middleware[hook].length; i++) {
      const handler = middleware[hook][i]
      value = handler(value, ...args)

      if (bailEarly && !value) {
        break
      }
    }

    return value
  }

  return applyMiddleware
}
