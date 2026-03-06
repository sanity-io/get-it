export const hostname = ((global: unknown) =>
  (typeof global === 'object' &&
    global !== null &&
    'window' in global &&
    typeof global.window === 'object' &&
    global.window !== null &&
    'location' in global.window &&
    typeof global.window.location === 'object' &&
    global.window.location !== null &&
    'hostname' in global.window.location &&
    typeof global.window.location.hostname === 'string' &&
    global.window.location.hostname) ||
  '127.0.0.1')(globalThis)

export const httpPort = 9980
export const httpsPort = 9443
export const baseUrl = `http://${hostname}:${httpPort}/req-test`
export const baseUrlHttps = `https://${hostname}:${httpsPort}/req-test`
