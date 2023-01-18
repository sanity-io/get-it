let actualGlobal: typeof globalThis

if (typeof globalThis !== 'undefined') {
  actualGlobal = globalThis
} else if (typeof window !== 'undefined') {
  actualGlobal = window
} else if (typeof global !== 'undefined') {
  actualGlobal = global
} else if (typeof self !== 'undefined') {
  actualGlobal = self
} else {
  actualGlobal = {} as any
}

export default actualGlobal
