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
      const e: any = new Error('Connection timed out on request' + host)
      e.code = 'ETIMEDOUT'
      req.destroy(e)
    }, delays.connect)
  }

  // Clear the connection timeout timer once a socket is assigned to the
  // request and is connected.
  req.on('socket', function assign(socket: any) {
    // Socket may come from Agent pool and may be already connected.
    if (!(socket.connecting || socket._connecting)) {
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

  function connect(socket: any) {
    clear()

    if (delays.socket !== undefined) {
      socket.setTimeout(delays.socket, function socketTimeoutHandler() {
        const e: any = new Error('Socket timed out on request' + host)
        e.code = 'ESOCKETTIMEDOUT'
        // HACK: The official documentation (https://nodejs.org/api/http.html#httprequesturl-options-callback)
        // claims that calling `req.destroy(err)` will emit the error on the response object as well.
        // However, I've never been able to reproduce this behavior. It always ends up being called with
        // "Error: aborted" instead. We really want the original error to surface. We workaround this
        // by destroying the response object _first_.
        const res = req._getItResponse
        if (res) res.destroy(e)
        req.destroy(e)
      })
    }
  }

  return req.on('error', clear)
}
