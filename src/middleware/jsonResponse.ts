import type {Middleware} from 'get-it'

/** @public */
export function jsonResponse(opts?: any) {
  return {
    onResponse: (response) => {
      const contentType = response.headers['content-type'] || ''
      const shouldDecode = (opts && opts.force) || contentType.includes('application/json')
      if (!response.body || !contentType || !shouldDecode) {
        return response
      }

      return {...response, body: tryParse(response.body)}
    },

    processOptions: (options) => ({
      ...options,
      headers: {Accept: 'application/json', ...options.headers},
    }),
  } satisfies Middleware

  function tryParse(body: any) {
    try {
      return JSON.parse(body)
    } catch (err: any) {
      err.message = `Failed to parsed response body as JSON: ${err.message}`
      throw err
    }
  }
}
