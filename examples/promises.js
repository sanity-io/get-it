/* eslint-disable */
// Promises
const requester = require('requestlib')
const {
  bodyParser,
  promise
} = require('requestlib/middleware')

// Instantiate an instance of the requester
const request = requester()

// Apply middleware
request.use(promise)
request.use(bodyParser)

// Do an actual request (can't be aborted, because it returns a promise)
const url = 'http://foo.bar'
request({url})
  .then(res => console.log(res.body))
  .catch(err => handleError(err))
