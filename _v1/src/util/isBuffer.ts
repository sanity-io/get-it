export const isBuffer =
  typeof Buffer === 'undefined' ? () => false : (obj: unknown) => Buffer.isBuffer(obj)
