// Preserve the module import in declarations so custom matchers augment Vitest's types.
import 'vitest'
import {expect} from 'vitest'

import {mockMatchers} from '../mock/vitestMatchers'

expect.extend(mockMatchers)

// Omit type parameters to support Assertion across Vitest versions.
declare module 'vitest' {
  interface Assertion {
    toHaveReceivedRequest(
      method: string,
      url: string,
      options?: import('../mock/createMockFetch').MockMatchOptions,
    ): void
    toHaveReceivedRequestTimes(method: string, url: string, times: number): void
    toHaveConsumedAllMocks(): void
    /**
     * Assert that the request has a matching header.
     *
     * - `toHaveHeader(name)` asserts presence only (`.not` asserts absence)
     * - `value` may be a string or an asymmetric matcher
     * - `name` may be an asymmetric matcher, tested against lowercased header names
     */
    toHaveHeader(name: string | import('../mock/matchers').AsymmetricMatcher, value?: unknown): void
    toHaveBody(expected: unknown): void
    toHaveQuery(expected: unknown): void
    toHaveMethod(expected: string): void
    toHaveUrl(expected: string): void
    toHaveBeenCancelled(): void
  }
}
