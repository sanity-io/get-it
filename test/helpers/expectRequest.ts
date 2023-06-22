import {expect} from 'vitest'

import type {MiddlewareChannels} from '../../src/types'

export const promiseRequest = (channels: MiddlewareChannels) =>
  new Promise<any>((resolve, reject) => {
    channels.error.subscribe(reject)
    channels.response.subscribe(resolve)
  })

export const expectRequest = (channels: MiddlewareChannels) => expect(promiseRequest(channels))

export const expectRequestBody = (channels: MiddlewareChannels) =>
  expect(promiseRequest(channels).then((res) => res.body))
