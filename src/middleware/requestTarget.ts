/** Formats a bounded request target for error messages. @internal */
export function formatRequestTarget(url: string, urlTemplate?: string, hasQuery = false): string {
  let target = urlTemplate?.trim()
  if (!target) {
    try {
      const input = url.trim()
      const absolute = /^[a-z][a-z\d+.-]*:/i.test(input)
      const parsed = absolute ? new URL(input) : new URL(input, 'http://get-it.invalid')
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '[invalid URL]'
      const host = absolute || input.startsWith('//') ? parsed.host : ''
      target = `${host}${parsed.pathname}${parsed.search || hasQuery ? '?…' : ''}`
    } catch {
      return '[invalid URL]'
    }
  }
  return target.length > 120 ? target.slice(0, 119) + '…' : target
}
