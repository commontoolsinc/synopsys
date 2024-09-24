export interface HTTPConnection extends AsyncIterable<RequestEvent> {
  nextRequest(): Promise<RequestEvent | null>
  close(): void
}

export interface RequestEvent {
  request: Request
  respondWith(response: Response | Promise<Response>): void
  waitUntil(promise: Promise<any>): void
}

export interface ServerOptions {
  /**
   * The port to listen on.
   */
  readonly port: number
  /**
   * A literal IP address or host name that can be resolved to an IP address.
   * If not specified, defaults to 0.0.0.0.
   *
   * **Note about** 0.0.0.0 While listening 0.0.0.0 works on all platforms,
   * the browsers on Windows don't work with the address 0.0.0.0. You should
   * show the message like server running on localhost:8080 instead of server
   * running on 0.0.0.0:8080 if your program supports Windows.
   */
  readonly hostname?: string
}

export interface TLSOptions {
  readonly key: Blob
  readonly certificate: Blob
}

export interface HTTPServerOptions extends ServerOptions {
  /**
   * If provided HTTPS serever will be used.
   */
  readonly tls?: TLSOptions | null | undefined
}
