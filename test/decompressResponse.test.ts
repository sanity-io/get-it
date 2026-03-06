import {IncomingMessage} from 'node:http'
import {PassThrough} from 'node:stream'
import zlib from 'node:zlib'
import {describe, expect, it} from 'vitest'

import {decompressResponse} from '../src/request/node/decompressResponse'

function createMockResponse(
  headers: Record<string, string>,
  body: Buffer,
): IncomingMessage {
  const stream = new PassThrough() as PassThrough & Partial<IncomingMessage>
  stream.headers = headers
  stream.statusCode = 200
  stream.statusMessage = 'OK'
  ;(stream as any).complete = false
  stream.once('end', () => {
    ;(stream as any).complete = true
  })
  process.nextTick(() => {
    stream.end(body)
    process.nextTick(() => stream.emit('close'))
  })
  return stream as unknown as IncomingMessage
}

function collectStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

function gzipSync(data: string): Buffer {
  return zlib.gzipSync(Buffer.from(data))
}

function deflateRawSync(data: string): Buffer {
  return zlib.deflateRawSync(Buffer.from(data))
}

const fixture = 'Compressible response content.\n'

describe('decompressResponse', () => {
  it('should decompress gzipped content', async () => {
    const compressed = gzipSync(fixture)
    const response = createMockResponse(
      {'content-encoding': 'gzip', 'content-type': 'text/plain'},
      compressed,
    )

    const decompressed = decompressResponse(response)
    const body = await collectStream(decompressed)

    expect(body.toString()).toBe(fixture)
  })

  it('should decompress brotli content', async () => {
    const compressed = zlib.brotliCompressSync(Buffer.from(fixture))
    const response = createMockResponse(
      {'content-encoding': 'br', 'content-type': 'text/plain'},
      compressed,
    )

    const decompressed = decompressResponse(response)
    const body = await collectStream(decompressed)

    expect(body.toString()).toBe(fixture)
  })

  it('should decompress zlib-wrapped deflate content', async () => {
    const compressed = zlib.deflateSync(Buffer.from(fixture))
    const response = createMockResponse({'content-encoding': 'deflate'}, compressed)

    const decompressed = decompressResponse(response)
    const body = await collectStream(decompressed)

    expect(body.toString()).toBe(fixture)
  })

  it('should handle raw deflate data (non-conformant servers)', async () => {
    // Use a payload whose raw deflate first byte has CM bit clear (bit 3 = 0),
    // which triggers the heuristic to detect raw deflate vs zlib-wrapped.
    const original = 'AAAA'
    const compressed = deflateRawSync(original)
    const response = createMockResponse({'content-encoding': 'deflate'}, compressed)

    const decompressed = decompressResponse(response)
    const body = await collectStream(decompressed)

    expect(body.toString()).toBe(original)
  })

  it('should remove content-length header after decompression', async () => {
    const compressed = gzipSync(fixture)
    const response = createMockResponse(
      {
        'content-encoding': 'gzip',
        'content-length': String(compressed.length),
      },
      compressed,
    )

    const decompressed = decompressResponse(response)
    const body = await collectStream(decompressed)

    expect(body.toString()).toBe(fixture)
    expect(decompressed.headers['content-length']).toBeUndefined()
  })

  it('should not mutate the original response headers', async () => {
    const compressed = gzipSync(fixture)
    const response = createMockResponse(
      {
        'content-encoding': 'gzip',
        'content-length': String(compressed.length),
      },
      compressed,
    )

    const decompressed = decompressResponse(response)
    await collectStream(decompressed)

    // Original response headers should still have both headers
    expect(response.headers['content-encoding']).toBe('gzip')
    expect(response.headers['content-length']).toBe(String(compressed.length))
    // Decompressed response headers should have them removed
    expect(decompressed.headers['content-encoding']).toBeUndefined()
    expect(decompressed.headers['content-length']).toBeUndefined()
  })

  it('should passthrough non-compressed responses', async () => {
    const response = createMockResponse(
      {'content-encoding': 'unicorn', 'content-type': 'text/plain'},
      Buffer.from(fixture),
    )

    const result = decompressResponse(response)
    // Should return the original response unchanged
    expect(result).toBe(response)
    expect(result.headers['content-encoding']).toBe('unicorn')

    const body = await collectStream(result)
    expect(body.toString()).toBe(fixture)
  })

  it('should handle empty streams', async () => {
    const response = createMockResponse({'content-encoding': 'gzip'}, Buffer.alloc(0))

    const decompressed = decompressResponse(response)
    const body = await collectStream(decompressed)

    expect(body.length).toBe(0)
  })

  it('should preserve custom properties on the response', async () => {
    const compressed = gzipSync(fixture)
    const response = createMockResponse({'content-encoding': 'gzip'}, compressed)
    ;(response as any).customProp = '🦄'

    const decompressed = decompressResponse(response)
    expect((decompressed as any).customProp).toBe('🦄')

    decompressed.destroy()
  })

  it('should propagate errors for truncated data', async () => {
    const compressed = gzipSync(fixture)
    // Truncate the compressed data to simulate corrupt/incomplete response
    const truncated = compressed.subarray(0, -1)
    const response = createMockResponse({'content-encoding': 'gzip'}, truncated)

    const decompressed = decompressResponse(response)

    await expect(collectStream(decompressed)).rejects.toThrow()
  })

  it('should not destroy underlying response on manual destroy', async () => {
    const compressed = gzipSync(fixture)
    const response = createMockResponse({'content-encoding': 'gzip'}, compressed)

    const decompressed = decompressResponse(response)
    decompressed.destroy()

    expect(decompressed.destroyed).toBe(true)
    expect(response.destroyed).toBe(false)
  })

  it('should destroy underlying response on stream processing errors', async () => {
    const compressed = gzipSync(fixture)
    const truncated = compressed.subarray(0, -1)
    const response = createMockResponse({'content-encoding': 'gzip'}, truncated)

    const decompressed = decompressResponse(response)

    await expect(collectStream(decompressed)).rejects.toThrow()

    expect(decompressed.destroyed).toBe(true)
    expect(response.destroyed).toBe(true)
  })
})
