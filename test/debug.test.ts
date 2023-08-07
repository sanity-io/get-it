import {getIt} from 'get-it'
import {debug, jsonRequest, jsonResponse} from 'get-it/middleware'
import util from 'util'
import {describe, expect, it} from 'vitest'

import {baseUrl} from './helpers'

describe('debug middleware', () => {
  const log = (str: any) => expect(str).to.be.a('string')

  it('should be able to use default options', () => {
    expect(() => debug()).to.not.throw()
  })

  it('should be able to pass custom logger', () =>
    new Promise<void>((resolve) => {
      const logger = debug({log})
      const request = getIt([baseUrl, logger])
      request({url: '/plain-text'}).response.subscribe(() => resolve(undefined))
    }))

  it('should be able to pass custom logger (verbose mode)', () =>
    new Promise<void>((resolve) => {
      const logger = debug({log, verbose: true})
      const request = getIt([baseUrl, logger])
      request({url: '/plain-text'}).response.subscribe(() => resolve(undefined))
    }))

  it('should be able to pass custom logger (verbose mode + json request body)', () =>
    new Promise((resolve) => {
      const logger = debug({log, verbose: true})
      const request = getIt([baseUrl, jsonRequest(), jsonResponse(), logger])
      request({url: '/json-echo', method: 'PUT', body: {foo: 'bar'}}).response.subscribe(() =>
        resolve(undefined),
      )
    }))

  it('should be able to pass custom logger (verbose mode + text request body)', () =>
    new Promise((resolve) => {
      const logger = debug({log, verbose: true})
      const request = getIt([baseUrl, logger])
      request({url: '/echo', body: 'Just some text'}).response.subscribe(() => resolve(undefined))
    }))

  it('should be able to pass custom logger (invalid JSON in response)', () =>
    new Promise((resolve) => {
      const logger = debug({log, verbose: true})
      const request = getIt([baseUrl, logger])
      request({url: '/invalid-json'}).response.subscribe(() => resolve(undefined))
    }))

  it('should redact sensitive headers in verbose mode', () =>
    new Promise((resolve) => {
      const lines: any[] = []
      const logIt = (line: any, ...args: any[]) => lines.push(util.format(line, ...args))
      const logger = debug({log: logIt, verbose: true})
      const request = getIt([baseUrl, logger])
      request({
        url: '/echo',
        headers: {CoOkIe: 'yes cookie', authorization: 'bearer auth'},
        body: 'Just some text',
      }).response.subscribe(() => {
        expect(lines.join('\n')).not.to.contain('yes cookie')
        expect(lines.join('\n')).to.contain('<redacted>')
        resolve(undefined)
      })
    }))
})
