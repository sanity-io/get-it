/* eslint-disable @typescript-eslint/no-explicit-any */
// Test that the Vercel Data Cache is fully supported: https://vercel.com/docs/infrastructure/data-cache

import {getIt} from 'get-it'
import {jsonResponse, promise} from 'get-it/middleware'

const request = getIt([jsonResponse(), promise()])

export async function getDuplicate() {
  // Passing a signal to the fetch call is supposed to opt-out of request memoization
  const {signal} = new AbortController()
  const res = await fetch('https://ppsg7ml5.api.sanity.io/vX/data/query/test?query=now()', {signal})
  const json = await res.json()
  return json.result
}

export async function getTimestamp(runtime: string) {
  // Dedupe test based on https://github.com/vercel/next.js/blob/5f9d2c55ca3ca3bd6a01cf60ced69d3dd2c64bf4/test/e2e/app-dir/app-fetch-deduping/app-fetch-deduping.test.ts#L50-L79
  if ((await getDuplicate()) !== (await getDuplicate())) {
    throw new Error('Deduping failed')
  }

  const [dynamicRes, staticRes] = await Promise.all([
    request({
      url: 'https://ppsg7ml5.apicdn.sanity.io/v1/data/query/test?query=now()',
      fetch: {cache: 'no-store'},
    }).then((res: any) => res.body?.result),
    request({
      url: 'https://ppsg7ml5.api.sanity.io/v1/data/query/test?query=now()',
      fetch: {cache: 'force-cache', next: {tags: [runtime]}},
    }).then((res: any) => res.body?.result),
  ])

  return [dynamicRes, staticRes]
}
