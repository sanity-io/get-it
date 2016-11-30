/* eslint-disable */

// Observables
const requester = require('requestlib')
const {
  bodyParser,
  observable,
  progress
} = require('requestlib/middleware')

// Instantiate an instance of the requester
const request = requester()

// Apply middleware
request.use(observable)
request.use(bodyParser)
request.use(progress)

// Do an actual request
const url = 'http://foo.bar'
const req = request({url})
  .filter(event => event.type === 'response')
  .subscribe({
    next: res => console.log(res.body),
    error: err => handleError(err)
  })

// Cancel request
setTimeut(req.unsubscribe, 1000)