import type {Middleware} from 'get-it'

import {type Progress, progressStream} from '../../util/progress-stream'

function normalizer(stage: 'download' | 'upload') {
  return (prog: Pick<Progress, 'percentage' | 'length' | 'transferred'>) => ({
    stage,
    percent: prog.percentage,
    total: prog.length,
    loaded: prog.transferred,
    lengthComputable: !(prog.length === 0 && prog.percentage === 0),
  })
}

/** @public */
export function progress() {
  let didEmitUpload = false
  const onDownload = normalizer('download')
  const onUpload = normalizer('upload')
  return {
    onHeaders: (response, evt) => {
      const stream = progressStream({time: 32})

      stream.on('progress', (prog) => evt.context.channels.progress.publish(onDownload(prog)))
      return response.pipe(stream)
    },

    onRequest: (evt) => {
      if (!evt.progress) {
        return
      }

      evt.progress.on('progress', (prog: Progress) => {
        didEmitUpload = true
        evt.context.channels.progress.publish(onUpload(prog))
      })
    },

    onResponse: (res, evt) => {
      if (!didEmitUpload && typeof evt.options.body !== 'undefined') {
        evt.channels.progress.publish(onUpload({length: 0, transferred: 0, percentage: 100}))
      }

      return res
    },
  } satisfies Middleware
}
