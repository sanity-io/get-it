import Pinkie from 'pinkie-promise'
import {expect} from 'vitest'

export default (channel) => expect(new Pinkie((resolve, reject) => channel.subscribe(resolve)))
