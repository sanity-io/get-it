const {expect} = require('chai')

exports.expectRequest = channels =>
  expect(new Promise((resolve, reject) => {
    channels.error.subscribe(reject)
    channels.response.subscribe(resolve)
  }))

exports.expectRequestBody = channels =>
  expect(new Promise((resolve, reject) => {
    channels.error.subscribe(reject)
    channels.response.subscribe(res => resolve(res.body))
  }))
