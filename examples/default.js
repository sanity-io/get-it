/* eslint-disable */

// Plain
const requester = require('requestlib')
const {bodyParser} = require('requestlib/middleware')

// Instantiate an instance of the requester
const request = requester()

// Apply middleware
request.use(bodyParser)

// Do an actual request (can't be aborted, because it returns a promise)
const url = 'http://foo.bar'
const req = request({url})
req.response.subscribe(res => console.log(res.body))
req.error.subscribe(err => handleError(err))

// Cancel request
setTimeout(() => req.abort.publish('abort'), 1000)
