import {expect} from 'vitest'

import type {MiddlewareChannels} from '../../src/types'

export const promiseRequest = (channels: MiddlewareChannels) =>
  new Promise<any>((resolve, reject) => {
    let completed = false
    channels.error.subscribe((err) => {
      if (completed) throw new Error('error received after promise completed')
      completed = true
      reject(err)
    })
    channels.response.subscribe((evt) => {
      if (completed) throw new Error('response received after promise completed')
      completed = true
      resolve(evt)
    })
  })

export const expectRequest = (channels: MiddlewareChannels) => expect(promiseRequest(channels))

export const expectRequestBody = (channels: MiddlewareChannels) =>
  expect(promiseRequest(channels).then((res) => res.body))
