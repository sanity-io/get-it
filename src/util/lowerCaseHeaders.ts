export function lowerCaseHeaders(headers: any) {
  return Object.keys(headers || {}).reduce((acc, header) => {
    acc[header.toLowerCase()] = headers[header]
    return acc
  }, {} as any)
}
