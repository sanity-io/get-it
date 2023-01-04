// Just testing if they throw or not

Deno.test('top-level import', async () => {
  const {getIt} = await import('get-it')
  console.log({getIt: typeof getIt})
})

Deno.test('importing package json', async () => {
  const {
    default: {version},
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
