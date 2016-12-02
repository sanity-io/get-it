const objectAssign = require('object-assign')

export const jsonResponse = {
  onResponse: response => {
    const contentType = response.headers['content-type']
    if (!response.body || contentType.indexOf('application/json') === -1) {
      return response
    }

    return objectAssign({}, response, {body: tryParse(response.body)})
  },

  processOptions: options => objectAssign({}, options, {
    headers: objectAssign({}, options.headers, {Accept: 'application/json'})
  })
}

function tryParse(body) {
  try {
    return JSON.parse(body)
  } catch (err) {
    err.message = `Failed to parsed response body as JSON: ${err.message}`
    throw err
  }
}
