// Just testing if they throw or not

Deno.test('top-level import', async () => {
  const {default: getIt} = await import('get-it')
  console.log({getIt: typeof getIt})
})

Deno.test('importing package json', async () => {
  const {
    default: {version}
  } = await import('get-it/package.json', {assert: {type: 'json'}})
  console.log({version})
})

Deno.test('named middleware imports', async () => {
  const {jsonRequest, jsonResponse, httpErrors, headers, promise} = await import(
    'get-it/middleware'
  )
  console.log({jsonRequest: typeof jsonRequest})
  console.log({jsonResponse: typeof jsonResponse})
  console.log({httpErrors: typeof httpErrors})
  console.log({headers: typeof headers})
  console.log({promise: typeof promise})
})

// @TODO disable tests until Deno adds support for export subpath patterns
// https://github.com/denoland/deno/issues/15605
/*
Deno.test('direct middleware imports', async () => {
  // https://github.com/sanity-io/client/blob/428bc53ab4d9879baf466030e0fc9e048e9eb9ef/src/http/request.js#L3-L7
  const {default: observable} = await import('get-it/lib/middleware/observable')
  const {default: jsonRequest} = await import('get-it/lib/middleware/jsonRequest')
  const {default: jsonResponse} = await import('get-it/lib/middleware/jsonResponse')
  const {default: progress} = await import('get-it/lib/middleware/progress')

  console.log({observable: typeof observable})
  console.log({jsonRequest: typeof jsonRequest})
  console.log({jsonResponse: typeof jsonResponse})
  console.log({progress: typeof progress})
})

Deno.test('direct lib-node middleware imports', async () => {
  // https://github.com/sanity-io/client/blob/428bc53ab4d9879baf466030e0fc9e048e9eb9ef/src/http/nodeMiddleware.js#L1-L3
  const {default: retry} = await import('get-it/lib-node/middleware/retry')
  const {default: debug} = await import('get-it/lib-node/middleware/debug')
  const {default: headers} = await import('get-it/lib-node/middleware/headers')

  console.log({retry: typeof retry})
  console.log({debug: typeof debug})
  console.log({headers: typeof headers})
})
// */
