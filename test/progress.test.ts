import fs from 'fs'
import {describe, expect, it} from 'vitest'
import implementation from 'zen-observable'

import {getIt} from '../src/index'
import {observable, progress} from '../src/middleware'
import {baseUrl, isNode} from './helpers'

describe('progress', () => {
  it('should be able to use progress middleware without side-effects', () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, progress()])
      const req = request({url: '/plain-text'})

      req.error.subscribe((err) =>
        reject(new Error(`error channel should not be called, got:\n\n${err.message}`))
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

        req.progress.subscribe((evt) => {
          events++
          expect(evt).to.containSubset({
            stage: 'download',
            lengthComputable: true,
          })
        })

        req.error.subscribe((err) =>
          reject(new Error(`error channel should not be called, got:\n\n${err.message}`))
        )
        req.response.subscribe(() => {
          expect(events).to.be.above(0)
          resolve(undefined)
        })
      }),
    {timeout: 10000}
  )

  it.runIf(isNode)(
    '[node] should emit upload progress events on strings',
    () =>
      new Promise((resolve, reject) => {
        const request = getIt([baseUrl, progress()])
        const req = request({url: '/plain-text', body: new Array(100).join('-')})
        let events = 0

        req.progress.subscribe((evt) => {
          if (evt.stage !== 'upload') {
            return
          }

          events++
          expect(evt).to.containSubset({
            stage: 'upload',
            lengthComputable: true,
          })
        })

        req.error.subscribe((err) =>
          reject(new Error(`error channel should not be called, got:\n\n${err.message}`))
        )
        req.response.subscribe(() => {
          expect(events).to.be.above(0)
          resolve(undefined)
        })
      })
  )

  it.runIf(isNode)(
    '[node] can tell requester how large the body is',
    () =>
      new Promise((resolve, reject) => {
        // This is flakey on node 6, works on all other versions though.
        const nodeVersion = parseInt(process.version.replace(/^v/, ''), 10)
        if (nodeVersion === 6) {
          resolve(undefined)
          return
        }

        const request = getIt([baseUrl, progress()])
        const body = fs.createReadStream(__filename)
        const bodySize = fs.statSync(__filename).size
        const req = request({url: '/plain-text', body, bodySize})
        let events = 0

        req.progress.subscribe((evt) => {
          if (evt.stage !== 'upload') {
            return
          }

          events++
          expect(evt).to.containSubset({
            stage: 'upload',
            lengthComputable: true,
          })
        })

        req.error.subscribe((err) =>
          reject(new Error(`error channel should not be called, got:\n\n${err.message}`))
        )
        req.response.subscribe(() => {
          expect(events).to.be.above(0, 'should have received progress events')
          resolve(undefined)
        })
      }),
    {timeout: 10000}
  )

  it(
    'progress events should be emitted on observable',
    () =>
      new Promise((resolve) => {
        const request = getIt([baseUrl, progress(), observable({implementation})])
        const obs = request({url: '/drip'})
          .filter((ev) => ev.type === 'progress')
          .subscribe((evt) => {
            expect(evt).to.containSubset({
              stage: 'download',
              lengthComputable: true,
            })

            obs.unsubscribe()
            resolve(undefined)
          })
      }),
    {timeout: 10000}
  )
})
