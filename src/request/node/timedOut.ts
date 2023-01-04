// Copied from `@sanity/timed-out`

export function timedOut(req: any, time: any) {
  if (req.timeoutTimer) {
    return req
  }

  const delays = isNaN(time) ? time : {socket: time, connect: time}
  const hostHeader = req.getHeader('host')
  const host = hostHeader ? ' to ' + hostHeader : ''

  if (delays.connect !== undefined) {
    req.timeoutTimer = setTimeout(function timeoutHandler() {
      req.abort()
      const e: any = new Error('Connection timed out on request' + host)
      e.code = 'ETIMEDOUT'
      req.emit('error', e)
    }, delays.connect)
  }

  // Clear the connection timeout timer once a socket is assigned to the
  // request and is connected.
  req.on('socket', function assign(socket: any) {
    // Socket may come from Agent pool and may be already connected.
    if (!(socket.connecting || socket._connecting)) {
      connect()
      return
    }

    socket.once('connect', connect)
  })

  function clear() {
    if (req.timeoutTimer) {
      clearTimeout(req.timeoutTimer)
      req.timeoutTimer = null
    }
  }

  function connect() {
    clear()

    if (delays.socket !== undefined) {
      // Abort the request if there is no activity on the socket for more
      // than `delays.socket` milliseconds.
      req.setTimeout(delays.socket, function socketTimeoutHandler() {
        req.abort()
        const e: any = new Error('Socket timed out on request' + host)
        e.code = 'ESOCKETTIMEDOUT'
        req.emit('error', e)
      })
    }
  }

  return req.on('error', clear)
}
