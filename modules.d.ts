declare module 'tunnel-agent' {
  export function httpOverHttp(options: any): any
  export function httpsOverHttp(options: any): any
  export function httpOverHttps(options: any): any
  export function httpsOverHttps(options: any): any
}

declare module 'same-origin' {
  export default function sameOrigin(uri1: string, uri2: string, ieMode?: boolean): boolean
}

declare module 'create-error-class' {
  interface ErrorClass {
    new (res: any, ctx: any): Error
  }
  export default function createErrorClass(
    className: string,
    setup: (this: any, res: any, ctx: any) => void
  ): ErrorClass
}
