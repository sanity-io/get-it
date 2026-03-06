import {expect} from 'vitest'

export default (channel: any) => expect(new Promise((resolve) => channel.subscribe(resolve)))
