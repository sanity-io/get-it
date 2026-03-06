export const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
export const httpPort = 9980
export const httpsPort = 9443
export const baseUrl = `http://${hostname}:${httpPort}/req-test`
export const baseUrlHttps = `https://${hostname}:${httpsPort}/req-test`
