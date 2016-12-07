# get-it

## Wanted features

* [ ] Developer-friendly assertions that are stripped in production to reduce bundle size and performance
* [ ] Progress upload/download events as middleware (available on observable/eventemitter)
* [ ] Stream response middleware?
* [x] All HTTP methods supported (obviously)
* [x] Configurable number of retries + "should retry" handler
* [x] Follow redirects (optional) up to limit
* [x] Gzip unwrapping support in node (browser automatically handles this)
* [x] Middleware-ish (like MJ's request lib)
* [x] Node and browser support (XHR), with small browser bundle footprint
* [x] Observable/promise/callback/eventemitter support as middleware (low-level by default)
* [x] Parsing of JSON request/response payloads as middleware
* [x] Send file/buffer/stuff as body, should just work
* [x] Timeouts with errors that are catchable (connect/response as separate in node)

## Options

* `rawBody` - Set to `true` to return the raw value of the response body, instead of a string. *Important note*: The returned body will be different in Node and browser environments. In Node, it will return a `Buffer`, while in browsers it will return an `ArrayBuffer`.

## Middleware

Each middleware is an object of hook => action bindings. They are called in the order they are added to the request instance using `request.use()`. For instance, if you want to always set a certain header on outgoing responses, you could do:

```
const isAwesome = {
  processOptions: options => Object.assign({
    headers: Object.assign({}, options.headers, {
      'X-Is-Awesome': 'Absolutely'
    })
  })
}

request.use(isAwesome)
```

The available hooks, their arguments and expected return values are as following:

### processOptions

Called once a new request is instantiated. Can be used to alter options before they are validated and turned into an actual HTTP request. This hook is used by the `base` middleware, which prefixes the passed URL if it is not an absolute URI already.

Arguments:

1. `options` - Object of request options passed to the request. Should be cloned if modifications are to be performed, to prevent unexpected side-effects.

Should return: Plain object of options to pass on to the rest of the middlewares.

### parseResponse

Called once a response has been received and the response body is ready.

@todo document

## Prior work

This module was inspired by the great work of others:

* [got](https://github.com/sindresorhus/got)
* [simple-get](https://github.com/feross/simple-get)
* [xhr](https://github.com/naugtur/xhr)
* [Axios](https://github.com/mzabriskie/axios/)
* [http-client](https://github.com/mjackson/http-client)
* [request](https://github.com/request/request)

## License

MIT-licensed. See LICENSE.
