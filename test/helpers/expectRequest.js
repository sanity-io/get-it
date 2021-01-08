const Pinkie = require('pinkie-promise')
const {expect} = require('chai')

exports.promiseRequest = (channels) =>
  new Pinkie((resolve, reject) => {
    channels.error.subscribe(reject)
    channels.response.subscribe(resolve)
  })

exports.expectRequest = (channels) => expect(exports.promiseRequest(channels))

exports.expectRequestBody = (channels) =>
  expect(exports.promiseRequest(channels).then((res) => res.body))
