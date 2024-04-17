/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, expect, test} from 'vitest'

/**
 * These tests run on a live Vercel Next.js deploy and end-to-end tests that `get-it` is able to forward options to the underlying `fetch` call.
 * These options are `cache`: `fetch(url, {cache: 'no-store'})` for opt-out of caching,
 *  `revalidate`: `fetch(url, {next: {revalidate: 60}})` for time-based revalidation
 * and `tags`: `fetch(url, {next: {tags: ['tag1', 'tag2']}})` for on-demand revalidation.
 * Below we're only testing `tags`, as that's enough to prove that the options are forwarded.
 */

const target = new URL(process.env.TARGET_URL || 'https://get-it-test-next.sanity.build')

describe(
  `Next.js data fetching revalidation on ${target}`,
  () => {
    const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration))
    const urls = {
      revalidate: new URL('/api/revalidate', target),
      nodejs: new URL('/nodejs', target),
      edge: new URL('/edge', target),
    }
    const get = async (url: URL) => {
      const res = await fetch(url)
      return res.text()
    }
    const queryResponse = (response: string, id: keyof typeof urls) => {
      const fragment = document.createElement('div')
      fragment.innerHTML = response

      return fragment.querySelector(`[id=${id}]`)?.innerHTML
    }
    const snapshot = async <const T extends keyof typeof urls>(id: T) => {
      const response = await get(urls[id])
      return queryResponse(response, id)
    }
    const revalidate = async <const T extends keyof typeof urls>(id: T) => {
      const url = new URL(urls.revalidate)
      url.searchParams.set('tag', id)
      await fetch(url)
      await fetch(urls[id])
      await sleep(1000)
      await fetch(urls[id])
    }

    describe('nodejs runtime', () => {
      test.skip('response should be cached initially', async () => {
        const initial = await snapshot('nodejs')
        await sleep(1000)
        expect(initial).toBe(await snapshot('nodejs'))
      })

      test('response should revalidate on demand', async () => {
        const initial = await snapshot('nodejs')
        await revalidate('nodejs')
        await sleep(1000)
        expect(initial).not.toBe(await snapshot('nodejs'))
      })
    })
    describe('edge runtime', () => {
      test.skip('response should be cached initially', async () => {
        const initial = await snapshot('edge')
        await sleep(1000)
        expect(initial).toBe(await snapshot('edge'))
      })

      test('response should revalidate on demand', async () => {
        const initial = await snapshot('edge')
        await revalidate('edge')
        await sleep(1000)
        expect(initial).not.toBe(await snapshot('edge'))
      })
    })
    describe('request deduping', () => {
      test('requests should only dedupe if no abort signal is given', async () => {
        const response = await get(new URL('/memo', target))
        expect(queryResponse(response, 'test1' as any)).toBe('success')
        expect(queryResponse(response, 'test2' as any)).toBe('success')
        expect(queryResponse(response, 'test3' as any)).toBe('success')
      })
    })
  },
  {timeout: 15000},
)
