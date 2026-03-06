import type {RetryOptions} from 'get-it'

import defaultShouldRetry from '../../util/browser-shouldRetry'
import sharedRetry from './shared-retry'

/** @public */
export const retry = (opts: Partial<RetryOptions> = {}) =>
  sharedRetry({shouldRetry: defaultShouldRetry, ...opts})

retry.shouldRetry = defaultShouldRetry
