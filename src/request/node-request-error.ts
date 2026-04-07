import type {ClientRequest} from 'http'

export class NodeRequestError extends Error {
  request: ClientRequest
  code?: string | undefined

  constructor(err: NodeJS.ErrnoException, req: any) {
    super(err.message)
    this.request = req
    this.code = err.code
  }
}
