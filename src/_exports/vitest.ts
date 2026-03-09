import {expect} from 'vitest'

import {mockMatchers} from '../mock/vitestMatchers'

expect.extend(mockMatchers)

// Augment vitest's Assertion interface
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T> {
    toHaveReceivedRequest(
      method: string,
      url: string,
      options?: import('../mock/createMockFetch').MockMatchOptions,
    ): void
    toHaveReceivedRequestTimes(method: string, url: string, times: number): void
    toHaveConsumedAllMocks(): void
    toHaveHeader(name: string, value: unknown): void
    toHaveBody(expected: unknown): void
    toHaveQuery(expected: unknown): void
    toHaveMethod(expected: string): void
    toHaveUrl(expected: string): void
  }
}
