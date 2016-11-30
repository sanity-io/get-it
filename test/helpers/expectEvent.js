const {expect} = require('chai')

module.exports = channel =>
  expect(new Promise((resolve, reject) =>
    channel.subscribe(resolve)
  ))

