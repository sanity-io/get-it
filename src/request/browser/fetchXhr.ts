/**
 * Mimicks the XMLHttpRequest API with only the parts needed for get-it's XHR adapter
 */
export class FetchXhr
  implements Pick<XMLHttpRequest, 'open' | 'abort' | 'getAllResponseHeaders' | 'setRequestHeader'>
{
  /**
   * Public interface, interop with real XMLHttpRequest
   */
  onabort: () => void
  onerror: (error?: any) => void
  onreadystatechange: () => void
  ontimeout: XMLHttpRequest['ontimeout']
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/readyState
   */
  readyState: 0 | 1 | 2 | 3 | 4 = 0
  response: XMLHttpRequest['response']
  responseText: XMLHttpRequest['responseText']
  responseType: XMLHttpRequest['responseType'] = ''
  status: XMLHttpRequest['status']
  statusText: XMLHttpRequest['statusText']
  withCredentials: XMLHttpRequest['withCredentials']

  /**
   * Private implementation details
   */
  #method: string
  #url: string
  #resHeaders: string
  #headers: Record<string, string> = {}
  #controller?: AbortController
  #init: RequestInit = {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _async is only declared for typings compatibility
  open(method: string, url: string, _async?: boolean) {
    this.#method = method
    this.#url = url
    this.#resHeaders = ''
    this.readyState = 1 // Open
    this.onreadystatechange()
    this.#controller = undefined
  }
  abort() {
    if (this.#controller) {
      this.#controller.abort()
    }
  }
  getAllResponseHeaders() {
    return this.#resHeaders
  }
  setRequestHeader(name: string, value: string) {
    this.#headers[name] = value
  }
  // Allow setting extra fetch init options, needed for runtimes such as Vercel Edge to set `cache` and other options in React Server Components
  setInit(init: RequestInit) {
    this.#init = init
  }
  send(body: BodyInit) {
    const textBody = this.responseType !== 'arraybuffer'
    const options: RequestInit = {
      ...this.#init,
      method: this.#method,
      headers: this.#headers,
      body,
    }
    if (typeof AbortController === 'function') {
      this.#controller = new AbortController()
      // The instanceof check ensures environments like Edge Runtime, Node 18 with built-in fetch
      // and more don't throw if `signal` doesn't implement`EventTarget`
      // Native browser AbortSignal implements EventTarget, so we can use it
      if (typeof EventTarget !== 'undefined' && this.#controller.signal instanceof EventTarget) {
        options.signal = this.#controller.signal
      }
    }

    // Some environments (like CloudFlare workers) don't support credentials in
    // RequestInitDict, and there doesn't seem to be any easy way to check for it,
    // so for now let's just make do with a document check :/
    if (typeof document !== 'undefined') {
      options.credentials = this.withCredentials ? 'include' : 'omit'
    }

    fetch(this.#url, options)
      .then((res): Promise<string | ArrayBuffer> => {
        res.headers.forEach((value: any, key: any) => {
          this.#resHeaders += `${key}: ${value}\r\n`
        })
        this.status = res.status
        this.statusText = res.statusText
        this.readyState = 3 // Loading
        return textBody ? res.text() : res.arrayBuffer()
      })
      .then((resBody) => {
        if (typeof resBody === 'string') {
          this.responseText = resBody
        } else {
          this.response = resBody
        }
        this.readyState = 4 // Done
        this.onreadystatechange()
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') {
          this.onabort()
          return
        }

        this.onerror?.(err)
      })
  }
}
