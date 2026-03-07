/* eslint-disable no-console */
/**
 * Prints example stack traces for different error scenarios.
 * Run with: npx tsx print-stack-trace.ts
 */
import {createRequest} from 'get-it'
import {retry} from 'get-it/middleware'

const fetch500 = async () => new Response('oops', {status: 500})

const withRetry = createRequest({
  fetch: fetch500,
  middleware: [retry({maxRetries: 1, retryDelay: () => 0})],
})

const plain = createRequest({fetch: fetch500})

async function printTrace(label: string, fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log(`\n=== ${label} ===`)
      console.log(err.stack)
    }
  }
}

async function testBuffered() {
  await plain({url: 'http://api.example.com/users'})
}

async function testBufferedRetry() {
  await withRetry({url: 'http://api.example.com/users'})
}

async function testJsonRetry() {
  await withRetry({url: 'http://api.example.com/users', as: 'json'})
}

async function testTextRetry() {
  await withRetry({url: 'http://api.example.com/users', as: 'text'})
}

async function testStreamRetry() {
  await withRetry({url: 'http://api.example.com/users', as: 'stream'})
}

async function main() {
  await printTrace('buffered, no middleware', testBuffered)
  await printTrace('buffered + retry', testBufferedRetry)
  await printTrace('as: json + retry', testJsonRetry)
  await printTrace('as: text + retry', testTextRetry)
  await printTrace('as: stream + retry', testStreamRetry)
}

main()
