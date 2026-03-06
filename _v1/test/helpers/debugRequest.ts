export default function debugRequest(req: any, body: any) {
  return {
    headers: req.headers,
    method: req.method,
    url: req.url,
    body: body ? body.toString() : null,
  }
}
