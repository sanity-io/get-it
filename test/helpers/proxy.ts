import fs from 'fs'
import http from 'http'
import https from 'https'
import path from 'path'
import url from 'url'

const httpsServerOptions = {
  key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server', 'cert.pem')),
}

const httpPort = 4000
const httpsPort = 4443

export function createProxyServer(proto: 'http' | 'https' = 'http') {
  return new Promise<http.Server | https.Server>((resolve, reject) => {
    const isHttp = proto === 'http'
    const protoPort = isHttp ? httpPort : httpsPort
    const protoOpts = isHttp ? {} : httpsServerOptions
    const requestHandler = (request: any, response: any) => {
      const parsed = url.parse(request.url)
      const opts = {
        host: parsed.hostname,
        port: parsed.port,
        path: parsed.path,
        rejectUnauthorized: false,
      }

      const transport = parsed.protocol === 'https:' ? https : http
      transport.get(opts, (res) => {
        let body = ''
        res.on('data', (data) => {
          body += data
        })
        res.on('end', () => {
          response.setHeader('X-Proxy-Auth', request.headers['proxy-authorization'] || 'none')
          response.setHeader('X-Proxy-Host', request.headers.host)
          response.setHeader('Content-Type', 'text/plain; charset=UTF-8')
          response.end(`${body} + proxy`)
        })
      })
    }
    const server = isHttp
      ? http.createServer(requestHandler)
      : https.createServer(protoOpts, requestHandler)
    server.on('error', reject)
    server.listen(protoPort, () => resolve(server))
  })
}
