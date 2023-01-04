const validUrl = /^https?:\/\//i

/** @public */
export function validateOptions(options: any): any {
  if (!validUrl.test(options.url)) {
    throw new Error(`"${options.url}" is not a valid URL`)
  }
}
