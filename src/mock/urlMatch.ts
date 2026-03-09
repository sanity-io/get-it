/**
 * Parsed URL with path and query parameters separated.
 * @public
 */
export interface ParsedUrl {
  path: string
  query: Record<string, string>
}

/**
 * Parse a URL string into its path and query components.
 * Handles both relative paths (`/api/docs?limit=10`) and full URLs
 * (`https://example.com/api/docs?limit=10`).
 * @internal
 */
export function parseUrl(url: string): ParsedUrl {
  let path: string
  let search: string

  if (/^https?:\/\//.test(url)) {
    const parsed = new URL(url)
    path = parsed.pathname
    search = parsed.search
  } else {
    const qIndex = url.indexOf('?')
    if (qIndex === -1) {
      path = url
      search = ''
    } else {
      path = url.slice(0, qIndex)
      search = url.slice(qIndex)
    }
  }

  const query: Record<string, string> = {}
  if (search) {
    const params = new URLSearchParams(search)
    params.forEach((value, key) => {
      query[key] = value
    })
  }

  return {path, query}
}

/**
 * Escape a single character for use in a regular expression.
 * @internal
 */
function escapeRegex(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Convert a glob pattern (supporting `*` and `**`) into a RegExp.
 *
 * - `*` matches any characters except `/` (single path segment).
 * - `**` matches any characters including `/` (multiple path segments).
 * @internal
 */
function globToRegex(pattern: string): RegExp {
  let regex = ''
  let i = 0
  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      regex += '.*'
      i += 2
    } else if (pattern[i] === '*') {
      regex += '[^/]*'
      i += 1
    } else {
      regex += escapeRegex(pattern[i])
      i += 1
    }
  }
  return new RegExp(`^${regex}$`)
}

/**
 * Check whether a pattern string contains glob characters.
 * @internal
 */
function isGlob(pattern: string): boolean {
  return pattern.includes('*')
}

/**
 * Match a URL path against a pattern.
 *
 * The pattern can be:
 * - An exact string (`/api/docs`)
 * - A glob pattern (`/api/docs/*`, `/api/**`)
 * - A predicate function that receives the path and returns a boolean
 * @internal
 */
export function matchUrl(
  pattern: string | ((url: string) => boolean),
  actualPath: string,
): boolean {
  if (typeof pattern === 'function') {
    return pattern(actualPath)
  }
  if (isGlob(pattern)) {
    return globToRegex(pattern).test(actualPath)
  }
  return pattern === actualPath
}
