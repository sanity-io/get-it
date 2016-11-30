/* eslint-disable */

// Callbacks
const requester = require('requestlib')
const {
  bodyParser,
  callback
} = require('requestlib/middleware')

// Instantiate an instance of the requester
const request = requester()

// Apply middleware
request.use(callback)
request.use(bodyParser)

// Do an actual request
const url = 'http://foo.bar'
const req = request({url}, (err, res) => {
  if (err) {
    handleError(err)
    return
  }

  console.log(res.body)
})

// Cancel request
setTimeout(req.abort, 1000)
