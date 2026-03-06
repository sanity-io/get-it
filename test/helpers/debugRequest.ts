export default function debugRequest(
  req: {headers: Record<string, string | string[] | undefined>; method?: string; url?: string},
  body: Buffer | null,
) {
  return {
    headers: req.headers,
    method: req.method,
    url: req.url,
    body: body ? body.toString() : null,
  }
}
