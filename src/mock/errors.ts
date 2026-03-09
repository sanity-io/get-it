/**
 * A single difference between an expected and actual value.
 * @internal
 */
export interface Diff {
  path: string
  expected: unknown
  actual: unknown
}

/**
 * Description of a registered mock for error reporting.
 * @public
 */
export interface MockDescription {
  description: string
  responsesRemaining: number
}

/**
 * Format a value for display in diff output.
 * @internal
 */
function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}

/**
 * Format a list of registered mocks for display.
 * @public
 */
export function formatMockList(mocks: MockDescription[]): string {
  return mocks
    .map((mock, i) => {
      const status =
        mock.responsesRemaining === 0
          ? 'exhausted'
          : `${mock.responsesRemaining} responses remaining`
      return `  ${i + 1}. ${mock.description} (${status})`
    })
    .join('\n')
}

/**
 * Error thrown when no registered mock matches a request.
 * Includes the closest mock (if any) with a diff of differences.
 *
 * @public
 */
export class MockFetchError extends Error {
  declare method: string
  declare url: string
  declare query: Record<string, string>
  declare body: unknown

  constructor(
    method: string,
    url: string,
    query: Record<string, string>,
    body: unknown,
    diffs: Diff[],
    allMocks: MockDescription[],
    closestDescription?: string,
  ) {
    const queryString = new URLSearchParams(query).toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url

    let message = `No mock matched ${method} ${fullUrl}`

    if (closestDescription) {
      message += `\n\n  Closest mock:\n    ${closestDescription}`

      if (diffs.length > 0) {
        message += '\n\n  Differences:'
        for (const diff of diffs) {
          message += `\n    ${diff.path}: expected ${formatValue(diff.expected)}, received ${formatValue(diff.actual)}`
        }
      }
    }

    if (allMocks.length > 0) {
      message += `\n\n  All registered mocks:\n${formatMockList(allMocks)}`
    }

    super(message)
    this.name = 'MockFetchError'
    this.method = method
    this.url = url
    this.query = query
    this.body = body
  }
}
