import fs from 'node:fs'

import {adapter, environment, getIt} from 'get-it'
import {observable, progress} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'
import implementation from 'zen-observable'

import {baseUrl} from './helpers'

// When using `fetch()` we currently don't support progress events
describe.skipIf(adapter === 'fetch')('progress', () => {
  it('should be able to use progress middleware without side-effects', () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, progress()])
      const req = request({url: '/plain-text'})

      req.error.subscribe((err: any) =>
        reject(new Error(`error channel should not be called, got:\n\n${err.message}`)),
      )
      req.response.subscribe(() => resolve(undefined))
    }))

  it(
    'should emit download progress events',
    () =>
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
    {timeout: 10000},
  )

  it.runIf(environment === 'node')('should emit upload progress events on strings', async () => {
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
  })

  it.runIf(environment === 'node')(
    'can tell requester how large the body is',
    () =>
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
    {timeout: 10000},
  )

  it(
    'progress events should be emitted on observable',
    () =>
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
    {timeout: 10000},
  )
})
