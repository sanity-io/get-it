import Pinkie from 'pinkie-promise'
import {expect} from 'vitest'

export const promiseRequest = (channels) =>
  new Pinkie((resolve, reject) => {
    channels.error.subscribe(reject)
    channels.response.subscribe(resolve)
  }) as Promise<any>

export const expectRequest = (channels) => expect(promiseRequest(channels))

export const expectRequestBody = (channels) =>
  expect(promiseRequest(channels).then((res) => res.body))
