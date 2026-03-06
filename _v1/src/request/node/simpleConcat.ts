/*! simple-concat. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
export function concat(stream: any, cb: any) {
  const chunks: any = []
  stream.on('data', function (chunk: any) {
    chunks.push(chunk)
  })
  stream.once('end', function () {
    if (cb) cb(null, Buffer.concat(chunks))
    cb = null
  })
  stream.once('error', function (err: any) {
    if (cb) cb(err)
    cb = null
  })
}
