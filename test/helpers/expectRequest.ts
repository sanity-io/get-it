import {expect} from 'vitest'

export const promiseRequest = (channels: any) =>
  new Promise<any>((resolve, reject) => {
    channels.error.subscribe(reject)
    channels.response.subscribe(resolve)
  })

export const expectRequest = (channels: any) => expect(promiseRequest(channels))

export const expectRequestBody = (channels: any) =>
  expect(promiseRequest(channels).then((res) => res.body))
