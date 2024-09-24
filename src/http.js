import { Task } from './lib.js'
import Stream from 'node:stream'
import * as API from './http/api.js'
export * from './http/api.js'

import * as body from '@web-std/fetch/body'
import { ReadableStream, TransformStream } from '@web-std/stream'
import { Request, Response, Headers, FormData, Blob } from '@web-std/fetch'
import * as HTTP from 'http'
import * as HTTPS from 'https'

/**
 * @typedef {(HTTP.Server|HTTPS.Server)} ServerSocket
 *
 * @param {ServerSocket} socket
 * @returns {API.HTTPConnection}
 */
export const open = (socket) => HTTPConnection.open(socket)
export { Request, Response, Headers, FormData, ReadableStream, Blob }

/**
 * @implements {API.HTTPConnection}
 */

class HTTPConnection {
  /**
   * @private
   * @param {ServerSocket} server
   * @param {ReadableStreamDefaultReader<RequestEvent>} reader
   * @param {WritableStreamDefaultWriter<RequestEvent>} writer
   */
  constructor(server, reader, writer) {
    this.server = server
    this.reader = reader
    this.writer = writer
    this.onrequest = this.onrequest.bind(this)
  }
  /**
   * @param {ServerSocket} server
   * @returns {API.HTTPConnection}
   */
  static open(server) {
    const { readable, writable } = new TransformStream()
    const listener = new this(
      server,
      readable.getReader(),
      writable.getWriter()
    )

    listener.open()

    return listener
  }
  open() {
    this.server.addListener('request', this.onrequest)
    return this
  }

  /**
   * @returns {Promise<RequestEvent|null>}
   */
  async nextRequest() {
    const read = await this.reader.read()
    if (read.done) {
      return null
    } else {
      return read.value
    }
  }

  close() {
    this.server.removeListener('request', this.onrequest)
    this.writer.close()
  }

  /**
   * @private
   * @param {HTTP.IncomingMessage} request
   * @param {HTTP.ServerResponse} response
   */
  onrequest(request, response) {
    this.writer.write(new RequestEvent(request, response))
  }

  /**
   * @param {Object} [options]
   * @param {boolean} [options.preventCancel=boolean]
   */
  async *[Symbol.asyncIterator]({ preventCancel = false } = {}) {
    try {
      while (true) {
        const result = await this.reader.read()

        if (result.done) {
          return
        }

        yield result.value
      }
    } finally {
      if (preventCancel !== true) {
        this.reader.cancel()
        // this.close()
      }
    }
  }
}

/**
 * @implements {API.RequestEvent}
 */
class RequestEvent {
  /**
   * @param {HTTP.IncomingMessage} incoming
   * @param {HTTP.ServerResponse} outgoing
   */
  constructor(incoming, outgoing) {
    this.incoming = incoming
    this.outgoing = outgoing
    this.writeResponse = this.writeResponse.bind(this)
    incoming

    Object.defineProperties(this, {
      incoming: { enumerable: false },
      outgoing: { enumerable: false },
      writeResponse: { enumerable: false },
    })
  }
  get request() {
    const { incoming } = this
    const socket = /** @type {import('tls').TLSSocket} */ (incoming.socket)
    const protocol = socket.encrypted ? 'https' : 'http'
    const url = `${protocol}://${incoming.headers.host}${incoming.url}`
    const { method } = incoming
    const body = method === 'GET' ? null : method === 'HEAD' ? null : incoming
    const request = new Request(url, {
      // @ts-ignore - ts is confused by this
      headers: new Headers({ ...incoming.headers, ...incoming.trailers }),
      method,
      duplex: 'half',
      // @ts-ignore - body can be node stream but that is not captured in types.
      body,
    })

    Object.defineProperties(this, {
      request: { value: request, enumerable: true },
    })

    return request
  }

  /**
   * @param {Response|Promise<Response>} response
   * @returns {void}
   */
  respondWith(response) {
    const write = isPromise(response)
      ? response.then(this.writeResponse)
      : this.writeResponse(response)
    this.waitUntil(write)
  }
  /**
   *
   * @param {Response} response
   */
  async writeResponse(response) {
    this.outgoing.writeHead(
      response.status,
      Object.fromEntries(
        // @ts-ignore - Headers has entries method
        response.headers.entries()
      )
    )

    const { body } = response
    const reader = body?.getReader()

    if (reader) {
      this.outgoing.once('close', () => reader.cancel('close'))
    }

    while (reader && !this.outgoing.closed) {
      const { done, value } = await reader.read()
      if (done) {
        break
      } else {
        this.outgoing.write(value)
      }
    }

    this.outgoing.end()
  }
  /**
   * @param {Promise<any>} promise
   */
  waitUntil(promise) {
    promise.then(() => {})
  }
}

/**
 * @template T, U
 * @param {Promise<T>|U} value
 * @returns {value is Promise<T>}
 */

const isPromise = (value) =>
  Boolean(value && typeof Object(value).then === 'function')

/**
 * @param {API.HTTPServerOptions} options
 */
export const listen = ({ port, hostname = '0.0.0.0', tls = null }) =>
  Task.spawn(function* () {
    const server = tls
      ? new HTTPS.Server({
          cert: Buffer.from(yield* Task.wait(tls.certificate.arrayBuffer())),
          key: Buffer.from(yield* Task.wait(tls.key.arrayBuffer())),
        })
      : new HTTP.Server()

    yield* Task.wait(onServerListen(server, { port, hostname }))
    return server
  })

/**
 *
 * @param {HTTP.Server|HTTPS.Server} server
 * @param {API.HTTPServerOptions} options
 * @returns
 */

const onServerListen = (server, options) =>
  new Promise((succeed) =>
    server.listen({ port: options.port, host: options.hostname }, () =>
      succeed(undefined)
    )
  )

/**
 *
 * @param {ServerSocket} socket
 */
export const address = (socket) =>
  /** @type {import('net').AddressInfo} */ (socket.address())

/**
 * @param {ServerSocket} socket
 */
export const port = (socket) => address(socket).port

/**
 * @param {ServerSocket} socket
 */
export const endpoint = (socket) => {
  const { address: ip, port } = address(socket)
  const protocol = socket instanceof HTTPS.Server ? 'https' : 'http'
  const hostname = ip === '0.0.0.0' ? 'localhost' : address
  return new URL(`${protocol}://${hostname}:${port}`)
}
