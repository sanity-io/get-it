export default function debugRequest(req, body) {
  return {
    headers: req.headers,
    method: req.method,
    url: req.url,
    body: body ? body.toString() : null,
  }
}
