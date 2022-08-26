// If fetch is defined we assume it's either a browser or a worker env (Bun, Deno or Edge) and we divert to the browser version
// Although Node is shipping `fetch` support soon this check
// won't affect it as Node respects conditional package exports and this file ain't listed.
module.exports =
  typeof fetch === 'function'
    ? require('./dist/esm/middleware/index.mjs')
    : require('./lib/middleware')
