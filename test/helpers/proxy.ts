import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import path from 'node:path'

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

    // Track CONNECT requests for test verification
    let connectCount = 0

    const requestHandler = (request: http.IncomingMessage, response: http.ServerResponse) => {
      const reqUrl = request.url ?? '/'

      // Verification endpoint: returns the number of CONNECT requests received
      if (reqUrl === '/__proxy_connect_count') {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({count: connectCount}))
        return
      }

      // Reset counter endpoint
      if (reqUrl === '/__proxy_reset') {
        connectCount = 0
        response.end('ok')
        return
      }

      // Traditional HTTP forwarding proxy (for non-CONNECT requests)
      const parsed = new URL(reqUrl)
      const opts = {
        host: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        rejectUnauthorized: false,
      }

      const transport = parsed.protocol === 'https:' ? https : http
      transport.get(opts, (res) => {
        let body = ''
        res.on('data', (data: string) => {
          body += data
        })
        res.on('end', () => {
          response.setHeader('X-Proxy-Auth', request.headers['proxy-authorization'] ?? 'none')
          response.setHeader('X-Proxy-Host', request.headers.host ?? '')
          response.setHeader('Content-Type', 'text/plain; charset=UTF-8')
          response.end(`${body} + proxy`)
        })
      })
    }

    const server = isHttp
      ? http.createServer(requestHandler)
      : https.createServer(protoOpts, requestHandler)

    // Handle CONNECT requests (used by undici's ProxyAgent for tunneling)
    server.on('connect', (req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
      connectCount++
      const url = req.url || ''
      const [hostname, portStr] = url.split(':')
      const port = parseInt(portStr || '80', 10)

      const targetSocket = net.connect(port, hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length > 0) {
          targetSocket.write(head)
        }
        clientSocket.pipe(targetSocket)
        targetSocket.pipe(clientSocket)
      })

      targetSocket.on('error', () => {
        clientSocket.end()
      })

      clientSocket.on('error', () => {
        targetSocket.end()
      })
    })

    server.on('error', reject)
    server.listen(protoPort, () => resolve(server))
  })
}
