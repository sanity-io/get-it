// Necessary for `get-it/middleware` imports to work with setups not setup to be ESM native, like older `jest` configs.
module.exports = require('./dist/middleware.cjs')
