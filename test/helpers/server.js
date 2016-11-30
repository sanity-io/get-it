const url = require('url')
const http = require('http')

const port = 41832
const responses = {
  plainText: 'Just some plain text for you to consume'
}

const createServer = () => {
  const server = http.createServer((req, res) => {
    const parts = url.parse(req.url, true)
    switch (parts.pathname) {
      case '/query-string':
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(parts.query))
        break
      case '/plain-text':
        res.setHeader('Content-Type', 'text/plain')
        res.end(responses.plainText)
        break
      case '/json':
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({foo: 'bar'}))
        break
      case '/json-echo':
        res.setHeader('Content-Type', 'application/json')
        req.pipe(res)
        break
      default:
        res.statusCode = 404
        res.end('File not found')
    }
  })

  return new Promise((resolve, reject) => {
    server.listen(port, () => resolve(server))
  })
}

createServer.port = port
createServer.responses = responses

module.exports = createServer
