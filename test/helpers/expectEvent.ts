import Pinkie from 'pinkie-promise'
import {expect} from 'vitest'

export default (channel) => expect(new Pinkie((resolve) => channel.subscribe(resolve)))
