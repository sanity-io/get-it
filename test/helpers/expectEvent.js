const Pinkie = require('pinkie-promise')
const {expect} = require('chai')

module.exports = (channel) => expect(new Pinkie((resolve, reject) => channel.subscribe(resolve)))
