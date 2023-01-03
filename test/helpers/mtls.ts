import fs from 'fs'
import https from 'https'
import path from 'path'

export default (port, serverOpts = {}) =>
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
      .on('error', reject)
      .listen(port, () => resolve(server))
  })
