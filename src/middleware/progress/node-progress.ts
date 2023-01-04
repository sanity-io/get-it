import progressStream from 'progress-stream'

function normalizer(stage: any) {
  return (prog: any) => ({
    stage,
    percent: prog.percentage,
    total: prog.length,
    loaded: prog.transferred,
    lengthComputable: !(prog.length === 0 && prog.percentage === 0),
  })
}

/** @public */
export function progress() {
  return {
    onHeaders: (response: any, evt: any) => {
      const _progress = progressStream({time: 16})
      const normalize = normalizer('download')

      // This is supposed to be handled automatically, but it has a bug,
      // see https://github.com/freeall/progress-stream/pull/22
      const contentLength = response.headers['content-length']
      const length = contentLength && Number(contentLength)
      if (!isNaN(length) && length > 0) {
        _progress.setLength(length)
      }

      _progress.on('progress', (prog) => evt.context.channels.progress.publish(normalize(prog)))
      return response.pipe(_progress)
    },

    onRequest: (evt: any) => {
      if (!evt.progress) {
        return
      }

      const normalize = normalizer('upload')
      evt.progress.on('progress', (prog: any) =>
        evt.context.channels.progress.publish(normalize(prog))
      )
    },
  }
}
