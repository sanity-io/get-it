// If fetch is defined we assume it's either a browser or a worker env (Bun, Deno or Edge) and we divert to the browser version
// Although Node is shipping `fetch` support soon this check
// won't affect it as Node respects conditional package exports and this file ain't listed.
// The EdgeRuntime check is to support dead-code elimination on Vercel Edge Functions:
// https://edge-runtime.vercel.sh/features/available-apis#addressing-the-runtime
module.exports =
  typeof fetch === 'function' || typeof EdgeRuntime === 'string'
    ? require('./dist/esm/index.mjs')
    : require('./lib-node')
