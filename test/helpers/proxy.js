const http = require('http')
const url = require('url')

module.exports = () =>
  new Promise((resolve, reject) => {
    const server = http
      .createServer((request, response) => {
        const parsed = url.parse(request.url)
        const opts = {
          host: parsed.hostname,
          port: parsed.port,
          path: parsed.path
        }

        http.get(opts, res => {
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
      })
      .listen(4000, err => (err ? reject(err) : resolve(server)))
  })
