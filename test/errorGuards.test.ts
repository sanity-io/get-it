import type {HttpErrorLike} from 'get-it'
import {HttpError, isHttpError, isTimeoutError, TimeoutError} from 'get-it'
import {describe, expect, it} from 'vitest'

import {createBufferedResponse} from '../src/response'

const requestUrl = 'https://example.com/original'
const responseUrl = 'https://example.com/final'

function createHttpError(): HttpError {
  const response = createBufferedResponse(
    404,
    'Not Found',
    new Headers(),
    new Uint8Array(),
    responseUrl,
    true,
  )
  return new HttpError({
    url: requestUrl,
    method: 'GET',
    status: 404,
    statusText: 'Not Found',
    headers: response.headers,
    body: response.body,
    response,
  })
}

describe('isHttpError', () => {
  it('recognizes an HttpError from this get-it copy', () => {
    const error: HttpErrorLike = createHttpError()
    expect(isHttpError(error)).toBe(true)
  })

  it('recognizes the public shape from another get-it copy', () => {
    const error = createHttpError()
    const crossVersionError = {
      name: error.name,
      message: error.message,
      url: error.url,
      method: error.method,
      status: error.status,
      statusText: error.statusText,
      headers: error.headers,
      body: error.body,
      response: {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        body: error.response.body,
      },
    }

    expect(crossVersionError).not.toBeInstanceOf(HttpError)
    expect(isHttpError(crossVersionError)).toBe(true)
  })

  it('narrows the error type', () => {
    const error: unknown = createHttpError()

    if (!isHttpError(error)) throw new Error('expected an HTTP error')
    expect(error.status).toBe(404)
    expect(error.response.url).toBe(responseUrl)
  })

  it('rejects errors with only the same name', () => {
    const error = new Error('not an HTTP error')
    error.name = 'HttpError'

    expect(isHttpError(error)).toBe(false)
  })

  it('rejects malformed response details', () => {
    const error = createHttpError()
    const malformed = {
      name: error.name,
      message: error.message,
      url: error.url,
      method: error.method,
      status: error.status,
      statusText: error.statusText,
      headers: error.headers,
      body: error.body,
      response: {status: '404'},
    }

    expect(isHttpError(malformed)).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isHttpError(null)).toBe(false)
    expect(isHttpError('HttpError')).toBe(false)
  })
})

describe('isTimeoutError', () => {
  it('recognizes a TimeoutError from this get-it copy', () => {
    const error = new TimeoutError({
      url: requestUrl,
      method: 'GET',
      timeoutMs: 1000,
      phase: 'headers',
    })

    expect(isTimeoutError(error)).toBe(true)
  })

  it('recognizes the public shape from another get-it copy', () => {
    const crossVersionError = {
      name: 'TimeoutError',
      message: 'Request timed out waiting for response headers',
      url: requestUrl,
      method: 'GET',
      timeoutMs: 1000,
      phase: 'headers',
      code: 'ETIMEDOUT',
    }

    expect(crossVersionError).not.toBeInstanceOf(TimeoutError)
    expect(isTimeoutError(crossVersionError)).toBe(true)
  })

  it('narrows the error type', () => {
    const error: unknown = new TimeoutError({
      url: requestUrl,
      method: 'GET',
      timeoutMs: 1000,
      phase: 'headers',
    })

    if (!isTimeoutError(error)) throw new Error('expected a timeout error')
    expect(error.phase).toBe('headers')
    expect(error.code).toBe('ETIMEDOUT')
  })

  it('does not classify a total-deadline DOMException as the get-it class', () => {
    const error = new DOMException('The operation timed out', 'TimeoutError')

    expect(isTimeoutError(error)).toBe(false)
  })

  it('rejects malformed and non-object values', () => {
    expect(isTimeoutError({name: 'TimeoutError'})).toBe(false)
    expect(isTimeoutError(undefined)).toBe(false)
  })
})
