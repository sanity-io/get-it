/* eslint-disable no-sync */
const fs = require('fs')
const path = require('path')
const https = require('https')

module.exports = (port, serverOpts = {}) =>
  new Promise((resolve, reject) => {
    const httpsServerOptions = {
      ca: fs.readFileSync(path.join(__dirname, '..', 'certs', 'mtls', 'ca.pem')),
      key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'mtls', 'server.key')),
      cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'mtls', 'server.pem')),
    }

    const options = Object.assign({}, httpsServerOptions, serverOpts)
    const server = https
      .createServer(options, (request, response) => {
        response.end('hello from mtls')
      })
      .listen(port, (err) => (err ? reject(err) : resolve(server)))
  })
