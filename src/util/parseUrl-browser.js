module.exports = href => {
  if (window.URL) {
    return new URL(href)
  }

  // Old browsers
  const parser = document.createElement('a')
  parser.href = href

  // Only for internal use, trust that we don't expose anything we shouldnt
  return parser
}
