import {getIt} from 'get-it'
import {httpErrors, observable} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'
import zenObservable from 'zen-observable'

import {baseUrl} from './helpers'

describe('observable middleware', () => {
  const implementation = zenObservable

  it('should turn the return value into an observable', () =>
    new Promise((resolve) => {
      const request = getIt([baseUrl, observable({implementation})])
      request({url: '/plain-text'})
        .filter((ev: any) => ev.type === 'response')
        .subscribe((res: any) => {
          expect(res).to.containSubset({
            body: 'Just some plain text for you to consume',
            method: 'GET',
            statusCode: 200,
          })

          resolve(undefined)
        })
    }))

  it('should trigger error handler on failures', () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, httpErrors(), observable({implementation})])
      request({url: '/status?code=500'}).subscribe({
        next: () => reject(new Error('next() called when error() should have been')),
        error: (err: any) => {
          expect(err.message).to.match(/HTTP 500/i)
          resolve(undefined)
        },
      })
    }))

  it('should not trigger request unless subscribe is called', () =>
    new Promise((resolve, reject) => {
      const onRequest = () => reject(new Error('Request triggered without subscribe()'))
      const request = getIt([baseUrl, observable({implementation}), {onRequest}])
      request({url: '/plain-text'})
      setTimeout(() => resolve(undefined), 100)
    }))

  it('should cancel the request when unsubscribing from observable', () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, observable({implementation})])
      const subscriber = request({url: '/delay'}).subscribe({
        next: () => reject(new Error('response channel should not be called when aborting')),
        error: (err: any) =>
          reject(
            new Error(`error channel should not be called when aborting, got:\n\n${err.message}`),
          ),
      })

      setTimeout(() => subscriber.unsubscribe(), 15)
      setTimeout(() => resolve(undefined), 250)
    }))

  // @todo test timeout errors
})
