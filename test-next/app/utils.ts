/* eslint-disable @typescript-eslint/no-explicit-any */
// Test that the Vercel Data Cache is fully supported: https://vercel.com/docs/infrastructure/data-cache

import {getIt} from 'get-it'
import {jsonResponse, promise} from 'get-it/middleware'

const request = getIt([jsonResponse(), promise()])

export async function getTimestamp(runtime: string) {
  const [dynamicRes, staticRes] = await Promise.all([
    request({
      url: 'https://ppsg7ml5.apicdn.sanity.io/v1/data/query/test?query=now()',
      fetch: {cache: 'no-store'},
    }).then((json: any) => json.body?.result),
    request({
      url: 'https://ppsg7ml5.api.sanity.io/v1/data/query/test?query=now()',
      fetch: {cache: 'force-cache', next: {tags: [runtime]}},
    }).then((json: any) => json.body?.result),
  ])
  return [dynamicRes, staticRes]
}
