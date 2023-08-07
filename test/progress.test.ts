import fs from 'node:fs'

import {adapter, environment, getIt} from 'get-it'
import {observable, progress} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'
import implementation from 'zen-observable'

import {baseUrl} from './helpers'

describe('progress', () => {
  it('should be able to use progress middleware without side-effects', () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, progress()])
      const req = request({url: '/plain-text'})

      req.error.subscribe((err: any) =>
        reject(new Error(`error channel should not be called, got:\n\n${err.message}`)),
      )
      req.response.subscribe(() => resolve(undefined))
    }))
  it('should be able to use progress middleware without side-effects', async () => {
    expect.hasAssertions()
    await expect(
      new Promise((resolve, reject) => {
        const request = getIt([baseUrl, progress()])
        const req = request({url: '/plain-text'})

        req.error.subscribe((err: any) =>
          reject(new Error(`error channel should not be called, got:\n\n${err.message}`)),
        )
        req.response.subscribe(() => resolve(undefined))
      }),
    ).resolves.toBeUndefined()
  })

  // @TODO add support for `adapter = fetch` when `ReadableStream` is available on `Response`
  it.skipIf(adapter === 'fetch')(
    'should emit download progress events',
    async () => {
      expect.hasAssertions()
      await expect(
        new Promise((resolve, reject) => {
          const request = getIt([baseUrl, progress()])
          const req = request({url: '/drip'})
          let events = 0

          req.progress.subscribe((evt: any) => {
            events++
            expect(evt).to.containSubset({
              stage: 'download',
              lengthComputable: true,
            })
          })

          req.error.subscribe((err: any) =>
            reject(new Error(`error channel should not be called, got:\n\n${err.message}`)),
          )
          req.response.subscribe(() => {
            expect(events).to.be.above(0)
            resolve(undefined)
          })
        }),
      ).resolves.toBeUndefined()
    },
    {timeout: 10000},
  )

  // @TODO support upload events in fetch if Request.body supports ReadableStream
  // @TODO make this test work in happy-dom
  it.skipIf(adapter === 'fetch' || environment === 'browser')(
    'should emit upload progress events on strings',
    async () => {
      expect.assertions(2)
      const promise = new Promise((resolve, reject) => {
        const request = getIt([baseUrl, progress()])
        const req = request({url: '/plain-text', body: new Array(100).join('-')})
        let events = 0

        req.progress.subscribe((evt: any) => {
          if (evt.stage !== 'upload') {
            return
          }

          events++
          expect(evt).to.containSubset({
            stage: 'upload',
            lengthComputable: true,
          })
        })

        req.error.subscribe((err: any) =>
          reject(new Error(`error channel should not be called, got:\n\n${err.message}`)),
        )
        req.response.subscribe(() => {
          if (events > 0) {
            resolve(events)
          }
        })
      })
      await expect(promise).resolves.toBeGreaterThan(0)
    },
  )

  // @TODO add support for `adapter = fetch`
  it.skipIf(environment === 'browser' || adapter === 'fetch')(
    'can tell requester how large the body is',
    async () => {
      expect.hasAssertions()
      await expect(
        new Promise((resolve, reject) => {
          const request = getIt([baseUrl, progress()])
          const body = fs.createReadStream(__filename)
          const bodySize = fs.statSync(__filename).size
          const req = request({url: '/plain-text', body, bodySize})
          let events = 0

          req.progress.subscribe((evt: any) => {
            if (evt.stage !== 'upload') {
              return
            }

            events++
            expect(evt).to.containSubset({
              stage: 'upload',
              lengthComputable: true,
            })
          })

          req.error.subscribe((err: any) =>
            reject(new Error(`error channel should not be called, got:\n\n${err.message}`)),
          )
          req.response.subscribe(() => {
            expect(events).to.be.above(0, 'should have received progress events')
            resolve(undefined)
          })
        }),
      ).resolves.toBeUndefined()
    },
    {timeout: 10000},
  )

  // @TODO add support for `adapter = fetch` when `ReadableStream` is available on `Response`
  it.skipIf(adapter === 'fetch')(
    'progress events should be emitted on observable',
    async () => {
      expect.hasAssertions()
      await expect(
        new Promise((resolve) => {
          const request = getIt([baseUrl, progress(), observable({implementation})])
          const obs = request({url: '/drip'})
            .filter((ev: any) => ev.type === 'progress')
            .subscribe((evt: any) => {
              expect(evt).to.containSubset({
                stage: 'download',
                lengthComputable: true,
              })

              obs.unsubscribe()
              resolve(undefined)
            })
        }),
      ).resolves.toBeUndefined()
    },
    {timeout: 10000},
  )
})
