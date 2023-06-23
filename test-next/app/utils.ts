/* eslint-disable @typescript-eslint/no-explicit-any */
// Test that the Vercel Data Cache is fully supported: https://vercel.com/docs/infrastructure/data-cache

import {getIt} from 'get-it'
import {jsonResponse, promise} from 'get-it/middleware'

const request = getIt([jsonResponse(), promise()])

export async function getTimestamp(runtime: string) {
  const [dynamicRes, staticRes] = await Promise.all([
    request({
      url: 'https://ppsg7ml5.api.sanity.io/v1/data/query/test?query=%7B%22dynamic%22%3A%20now()%7D',
      fetch: {cache: 'no-store'},
    }).then((json: any) => json.body.result.dynamic),
    request({
      url: 'https://ppsg7ml5.api.sanity.io/v1/data/query/test?query=%7B%22static%22%3A%20now()%7D',
      fetch: {cache: 'force-cache', next: {tags: [runtime]}},
    }).then((json: any) => json.body.result.static),
  ])
  return [dynamicRes, staticRes]
}
