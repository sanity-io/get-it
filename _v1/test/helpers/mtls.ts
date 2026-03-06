import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'

export default (port: number, serverOpts = {}) =>
  new Promise((resolve, reject) => {
    const httpsServerOptions = {
      ca: fs.readFileSync(path.join(__dirname, '..', 'certs', 'mtls', 'ca.pem')),
      key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'mtls', 'server.key')),
      cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'mtls', 'server.pem')),
    }

    const options = Object.assign({}, httpsServerOptions, serverOpts)
    const server = https
      .createServer(options, (_request, response) => {
        response.end('hello from mtls')
      })
      .on('error', reject)
      .listen(port, () => resolve(server))
  })
