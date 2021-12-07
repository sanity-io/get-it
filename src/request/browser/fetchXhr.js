/**
 * Mimicks the XMLHttpRequest API with only the parts needed for get-it's XHR adapter
 */
function FetchXhr() {
  this.readyState = 0 // Unsent
}
FetchXhr.prototype.open = function(method, url) {
  this._method = method
  this._url = url
  this._resHeaders = ''
  this.readyState = 1 // Open
  this.onreadystatechange()
}
FetchXhr.prototype.abort = function() {
  if (this._controller) {
    this._controller.abort()
  }
}
FetchXhr.prototype.getAllResponseHeaders = function() {
  return this._resHeaders
}
FetchXhr.prototype.setRequestHeader = function(key, value) {
  this._headers = this._headers || {}
  this._headers[key] = value
}
FetchXhr.prototype.send = function(body) {
  // eslint-disable-next-line no-multi-assign
  const ctrl = (this._controller = typeof AbortController === 'function' && new AbortController())
  const textBody = this.responseType !== 'arraybuffer'
  const options = {
    method: this._method,
    headers: this._headers,
    signal: ctrl && ctrl.signal,
    body
  }

  // Some environments (like CloudFlare workers) don't support credentials in
  // RequestInitDict, and there doesn't seem to be any easy way to check for it,
  // so for now let's just make do with a window check :/
  if (typeof window !== 'undefined') {
    options.credentials = this.withCredentials ? 'include' : 'omit'
  }

  fetch(this._url, options)
    .then(res => {
      res.headers.forEach((value, key) => {
        this._resHeaders += `${key}: ${value}\r\n`
      })
      this.status = res.status
      this.statusText = res.statusText
      this.readyState = 3 // Loading
      return textBody ? res.text() : res.arrayBuffer()
    })
    .then(resBody => {
      if (textBody) {
        this.responseText = resBody
      } else {
        this.response = resBody
      }
      this.readyState = 4 // Done
      this.onreadystatechange()
    })
    .catch(err => {
      if (err.name === 'AbortError') {
        this.onabort()
        return
      }

      this.onerror(err)
    })
}

module.exports = FetchXhr
