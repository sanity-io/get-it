import {getIt} from 'get-it'
import {httpErrors} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {baseUrl, baseUrlPrefix, expectRequest} from './helpers'

describe('errors', () => {
  it('should not respond with errors on HTTP >= 400 by default', async () => {
    const request = getIt([baseUrl])
    const req = request({url: '/status?code=400'})
    await expectRequest(req).resolves.toHaveProperty('statusCode', 400)
  })

  it('should error when httpErrors middleware is enabled and response code is >= 400', async () => {
    const request = getIt([baseUrl, httpErrors()])
    const req = request({url: '/status?code=400', headers: {foo: 'bar'}})
    req.response.subscribe(() => {
      throw new Error('Response channel called when error channel should have been triggered')
    })
    const err: any = await new Promise((resolve) => req.error.subscribe(resolve))
    expect(err).to.be.an.instanceOf(Error)
    expect(err.message).to.eq(
      'GET-request to http://localhost:9980/req-test/status?code=400 resulted in HTTP 400 Bad Request'
    )
    expect(err.message).to.include('HTTP 400').and.include('Bad Request')
    expect(err)
      .to.have.property('response')
      .and.containSubset({
        url: `${baseUrlPrefix}/status?code=400`,
        method: 'GET',
        statusCode: 400,
        statusMessage: 'Bad Request',
        body: '---',
      })

    expect(err.request.headers).toMatchObject({
      foo: 'bar',
    })
  })

  it('should truncate really long URLs from error message', async () => {
    const request = getIt([baseUrl, httpErrors()])
    const rep = new Array(1024).join('a')
    const req = request({url: `/status?code=400&foo=${rep}`, headers: {foo: 'bar'}})
    req.response.subscribe(() => {
      throw new Error('Response channel called when error channel should have been triggered')
    })
    const err: any = await new Promise((resolve) => req.error.subscribe(resolve))
    expect(err).to.be.an.instanceOf(Error)
    expect(err.message).to.have.length.lessThan(600)
  })

  it('should not error when httpErrors middleware is enabled and response code is < 400', async () => {
    const request = getIt([baseUrl, httpErrors()])
    const req = request({url: '/plain-text'})
    await expectRequest(req).resolves.toMatchObject({
      statusCode: 200,
      body: 'Just some plain text for you to consume',
    })
  })

  it('should only call onError middlewares up to the first one that returns null', async () => {
    const errs: any[] = []
    const first = {onError: (err: any) => errs.push(err) && err}
    const second = {
      onError: (err: any, ctx: any) => {
        errs.push(err)
        ctx.channels.response.publish({
          body: 'works',
          method: 'GET',
          headers: {},
          statusCode: 200,
          statusMessage: 'OK',
        })
      },
    }
    const third = {onError: (err: any) => errs.push(err)}
    const request = getIt([baseUrl, first, second, third])
    const req = request({url: '/permafail'})

    await Promise.all([
      expectRequest(req).resolves.toMatchObject({statusCode: 200}),
      new Promise((resolve) => setTimeout(resolve, 500)).then(() => {
        expect(errs).to.have.length(2)
      }),
    ])
  })
})
