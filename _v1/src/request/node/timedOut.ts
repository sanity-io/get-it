// Copied from `@sanity/timed-out`

import type {IncomingMessage} from 'node:http'
import type {Socket} from 'node:net'

export function timedOut(req: any, time: any) {
  if (req.timeoutTimer) {
    return req
  }

  const delays = isNaN(time) ? time : {socket: time, connect: time}
  const hostHeader = req.getHeader('host')
  const host = hostHeader ? ' to ' + hostHeader : ''

  if (delays.connect !== undefined) {
    req.timeoutTimer = setTimeout(function timeoutHandler() {
      const e: NodeJS.ErrnoException = new Error('Connection timed out on request' + host)
      e.code = 'ETIMEDOUT'
      req.destroy(e)
    }, delays.connect)
  }

  // Clear the connection timeout timer once a socket is assigned to the
  // request and is connected.
  req.on('socket', function assign(socket: Socket) {
    // Socket may come from Agent pool and may be already connected.
    if (!socket.connecting) {
      connect(socket)
      return
    }

    socket.once('connect', () => connect(socket))
  })

  function clear() {
    if (req.timeoutTimer) {
      clearTimeout(req.timeoutTimer)
      req.timeoutTimer = null
    }
  }

  function connect(socket: Socket) {
    clear()

    if (delays.socket !== undefined) {
      const socketTimeoutHandler = () => {
        const e: NodeJS.ErrnoException = new Error('Socket timed out on request' + host)
        e.code = 'ESOCKETTIMEDOUT'
        socket.destroy(e)
      }

      socket.setTimeout(delays.socket, socketTimeoutHandler)
      req.once('response', (response: IncomingMessage) => {
        response.once('end', () => {
          socket.removeListener('timeout', socketTimeoutHandler)
        })
      })
    }
  }

  return req.on('error', clear)
}
