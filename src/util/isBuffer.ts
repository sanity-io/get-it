import global from './global'

export const isBuffer = 'Buffer' in global ? (obj: unknown) => Buffer.isBuffer(obj) : () => false
