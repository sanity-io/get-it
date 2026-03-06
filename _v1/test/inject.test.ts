import {getIt} from 'get-it'
import {injectResponse} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {baseUrl, expectRequestBody, promiseRequest} from './helpers'

describe('inject response', () => {
  it('should throw if not provided with an `inject` function', () => {
    expect(injectResponse).to.throw(/inject/)
  })

  it('should be able to inject before dns resolution', async () => {
    const inject = () => ({body: 'foo'})
    const request = getIt([injectResponse({inject})])
    const req = request({url: 'http://some-unknown-host'})

    await expectRequestBody(req).resolves.toEqual('foo')
  })

  it('should be able to specify headers', async () => {
    const headers = {'x-my-mock': 'is-mocked'}
    const inject = () => ({headers})
    const request = getIt([baseUrl, injectResponse({inject})])
    const req = request({url: '/headers'})

    const res = await promiseRequest(req)
    expect(res).toHaveProperty('headers')
    expect(res.headers).toHaveProperty('x-my-mock', 'is-mocked')
  })

  it('should be able to use real request on a per-request basis', async () => {
    const mock = {body: 'Just some mocked text'}
    const inject = (evt: any) => evt.context.options.url.includes('/mocked') && mock
    const request = getIt([baseUrl, injectResponse({inject})])
    const normalReq = request({url: '/plain-text'})
    const mockedReq = request({url: '/mocked'})

    await Promise.all([
      expectRequestBody(normalReq).resolves.toMatch('Just some plain text'),
      expectRequestBody(mockedReq).resolves.toMatch('Just some mocked text'),
    ])
  })

  it('should be able to immediately cancel request', () =>
    new Promise((resolve, reject) => {
      const inject = () => ({body: 'foo'})
      const request = getIt([injectResponse({inject})])
      const req = request({url: 'http://blah-blah'})

      req.error.subscribe((err: any) =>
        reject(
          new Error(`error channel should not be called when aborting, got:\n\n${err.message}`),
        ),
      )
      req.response.subscribe(() =>
        reject(new Error('response channel should not be called when aborting')),
      )

      req.abort.publish()

      setTimeout(() => resolve(undefined), 250)
    }))
})
