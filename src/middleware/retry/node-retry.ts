import type {RetryOptions} from '../../types'
import defaultShouldRetry from '../../util/node-shouldRetry'
import sharedRetry from './shared-retry'

/** @public */
export const retry = (opts: Partial<RetryOptions> = {}) =>
  sharedRetry({shouldRetry: defaultShouldRetry, ...opts})

retry.shouldRetry = defaultShouldRetry
