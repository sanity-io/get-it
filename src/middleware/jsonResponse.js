const objectAssign = require('object-assign')

export const jsonResponse = {
  parseResponse: response => objectAssign({}, response, {
    body: JSON.parse(response.body)
  }),

  processOptions: options => objectAssign({}, options, {
    headers: objectAssign({}, options.headers, {Accept: 'application/json'})
  })
}
