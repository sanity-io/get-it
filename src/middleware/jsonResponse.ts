/** @public */
export function jsonResponse(opts?: any) {
  return {
    onResponse: (response: any) => {
      const contentType = response.headers['content-type'] || ''
      const shouldDecode = (opts && opts.force) || contentType.indexOf('application/json') !== -1
      if (!response.body || !contentType || !shouldDecode) {
        return response
      }

      return Object.assign({}, response, {body: tryParse(response.body)})
    },

    processOptions: (options: any) =>
      Object.assign({}, options, {
        headers: Object.assign({Accept: 'application/json'}, options.headers),
      }),
  }

  function tryParse(body: any) {
    try {
      return JSON.parse(body)
    } catch (err: any) {
      err.message = `Failed to parsed response body as JSON: ${err.message}`
      throw err
    }
  }
}
