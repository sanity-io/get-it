/**
 * Inlined, reduced variant of npm `progress-stream` (https://github.com/freeall/progress-stream),
 * that fixes a bug with `content-length` header. BSD 2-Clause Simplified License,
 * Copyright (c) Tobias Baunbæk <freeall@gmail.com>.
 */
import type {Transform} from 'stream'
import through from 'through2'

import {speedometer} from './speedometer'

export interface Progress {
  percentage: number
  transferred: number
  length: number
  remaining: number
  eta: number
  runtime: number
  delta: number
  speed: number
}

export interface ProgressStream extends Transform {
  progress(): Progress
}

export function progressStream(options: {time: number; length?: number}): ProgressStream {
  let length = options.length || 0
  let transferred = 0
  let nextUpdate = Date.now() + options.time
  let delta = 0
  const speed = speedometer(5)
  const startTime = Date.now()

  const update = {
    percentage: 0,
    transferred: transferred,
    length: length,
    remaining: length,
    eta: 0,
    runtime: 0,
    speed: 0,
    delta: 0,
  }

  const emit = function (ended: boolean) {
    update.delta = delta
    update.percentage = ended ? 100 : length ? (transferred / length) * 100 : 0
    update.speed = speed.getSpeed(delta)
    update.eta = Math.round(update.remaining / update.speed)
    update.runtime = Math.floor((Date.now() - startTime) / 1000)
    nextUpdate = Date.now() + options.time

    delta = 0

    tr.emit('progress', update)
  }

  const write = function (
    chunk: Buffer,
    _enc: string,
    callback: (err: Error | null, data?: Buffer) => void,
  ) {
    const len = chunk.length
    transferred += len
    delta += len
    update.transferred = transferred
    update.remaining = length >= transferred ? length - transferred : 0

    if (Date.now() >= nextUpdate) emit(false)
    callback(null, chunk)
  }

  const end = function (callback: (err?: Error | null) => void) {
    emit(true)
    speed.clear()
    callback()
  }

  const tr = through({}, write, end) as ProgressStream
  const onlength = function (newLength: number) {
    length = newLength
    update.length = length
    update.remaining = length - update.transferred
    tr.emit('length', length)
  }

  tr.on('pipe', function (stream) {
    if (length > 0) return

    // Support http module
    if (
      stream.readable &&
      !('writable' in stream) &&
      'headers' in stream &&
      isRecord(stream.headers)
    ) {
      const contentLength =
        typeof stream.headers['content-length'] === 'string'
          ? parseInt(stream.headers['content-length'], 10)
          : 0
      return onlength(contentLength)
    }

    // Support streams with a length property
    if ('length' in stream && typeof stream.length === 'number') {
      return onlength(stream.length)
    }

    // Support request module
    stream.on('response', function (res) {
      if (!res || !res.headers) return
      if (res.headers['content-encoding'] === 'gzip') return
      if (res.headers['content-length']) {
        return onlength(parseInt(res.headers['content-length']))
      }
    })
  })

  tr.progress = function () {
    update.speed = speed.getSpeed(0)
    update.eta = Math.round(update.remaining / update.speed)

    return update
  }

  return tr
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
