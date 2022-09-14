const validUrl = /^https?:\/\//i

export default options => {
  if (!validUrl.test(options.url)) {
    throw new Error(`"${options.url}" is not a valid URL`)
  }
}
