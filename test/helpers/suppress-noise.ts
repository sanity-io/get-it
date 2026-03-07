// Suppress happy-dom's fetch error logging and server-side socket errors
// from intentional connection resets during tests.
function isNoise(str: string): boolean {
  if (/\b(GET|POST|PUT|PATCH|DELETE|HEAD) https?:\/\//.test(str)) return true
  if (str.includes('socket hang up') || str.includes('ECONNRESET')) return true
  return false
}

function patchWrite(stream: NodeJS.WriteStream): void {
  const orig = stream.write.bind(stream)
  stream.write = function write(chunk: string | Uint8Array, ...rest: never[]) {
    const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
    if (isNoise(str)) return true
    return orig(chunk, ...rest)
  }
}

patchWrite(process.stdout)
patchWrite(process.stderr)
