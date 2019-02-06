/* eslint-disable no-sync */
const fs = require('fs')
const url = require('url')
const path = require('path')
const http = require('http')
const https = require('https')

const httpsServerOptions = {
  key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server', 'certificate.pem'))
}

const httpPort = 4000
const httpsPort = 4443

module.exports = (proto = 'http', serverOpts = {}) =>
  new Promise((resolve, reject) => {
    const isHttp = proto === 'http'
    const protoOpts = isHttp ? {} : httpsServerOptions
    const protoPort = isHttp ? httpPort : httpsPort
    const options = Object.assign({}, protoOpts, serverOpts)
    const requestHandler = (request, response) => {
      const parsed = url.parse(request.url)
      const opts = {
        host: parsed.hostname,
        port: parsed.port,
        path: parsed.path
      }

      const transport = parsed.protocol === 'https:' ? https : http
      transport.get(opts, res => {
        let body = ''
        res.on('data', data => {
          body += data
        })
        res.on('end', () => {
          response.setHeader('X-Proxy-Auth', request.headers['proxy-authorization'] || 'none')
          response.setHeader('Content-Type', 'text/plain; charset=UTF-8')
          response.end(`${body} + proxy`)
        })
      })
    }
    const server = (isHttp
      ? http.createServer(requestHandler)
      : https.createServer(options, requestHandler)
    ).listen(protoPort, err => (err ? reject(err) : resolve(server)))
  })
