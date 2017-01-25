const getUri = require('get-uri')

module.exports = uri => new Promise((resolve, reject) => {
  getUri(uri, (err, stream) => {
    if (err) {
      reject(err)
    } else {
      resolve(stream)
    }
  })
})
