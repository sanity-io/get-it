const objectAssign = require('object-assign')

export const jsonResponse = {
  parseResponseBody: (body, response) => JSON.parse(body),
  processOptions: options => objectAssign({}, options, {
    headers: objectAssign({}, options.headers, {Accept: 'application/json'})
  })
}
