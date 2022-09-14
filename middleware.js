// The EdgeRuntime check is to support dead-code elimination on Vercel Edge Functions:
// https://edge-runtime.vercel.sh/features/available-apis#addressing-the-runtime
if (typeof EdgeRuntime === 'string') {
  module.exports = require('./dist/esm/middleware/index.mjs')
} else {
  module.exports = require('./lib/middleware')
}
