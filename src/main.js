import { Task } from './lib.js'
import * as HTTP from './http.js'
import * as Service from './service.js'
import process from 'node:process'

/**
 * @typedef {object} Options
 * @property {number} [port]
 * @property {string} [store]
 *
 * @param {Options} options
 */
export const main = function* ({
  port = Number(process.env.PORT ?? 8080),
  store = process.env.STORE ?? '../service-store',
} = {}) {
  const url = new URL(store, import.meta.url)
  const service = yield* Service.open(url)
  try {
    const socket = yield* HTTP.listen({ port })
    const server = yield* Task.fork(serve(service, socket))
    const reason = yield* Task.wait(onTerminate())
    server.abort(reason)
  } finally {
    yield* Service.close(service)
    process.exit()
  }
}

/**
 * @returns {Promise<NodeJS.Signals>}
 */
const onTerminate = () =>
  new Promise((resolve) => process.on('SIGINT', (signal) => resolve(signal)))

/**
 * @param {Service.MutableSelf} service
 * @param {HTTP.ServerSocket} socket
 */
function* serve(service, socket) {
  const connection = HTTP.open(socket)
  const requests = connection[Symbol.asyncIterator]()
  try {
    while (true) {
      const { value: event, done } = yield* Task.wait(requests.next())
      if (done) {
        break
      }

      switch (event.request.method) {
        case 'OPTIONS': {
          event.respondWith(
            new HTTP.Response(null, {
              status: 204,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH',
                'Access-Control-Allow-Headers': 'Content-Type',
              },
            })
          )
          break
        }
        case 'PUT': {
          const promise = Task.perform(
            Service.openSession(service, event.request)
          )
          event.respondWith(promise)
          break
        }
        case 'PATCH': {
          const promise = Task.perform(Service.publish(service, event.request))
          event.respondWith(promise)
          break
        }
        case 'GET': {
          const promise = Task.perform(
            Service.subscribe(service, event.request)
          )
          event.respondWith(promise)
          break
        }
        default: {
          event.respondWith(
            new HTTP.Response('Method Not Allowed', { status: 405 })
          )
        }
      }
    }
  } catch (error) {
    if (/** @type {{reason?:unknown}} */ (error).reason !== 'SIGINT') {
      throw error
    }
  } finally {
    connection.close()
  }
}

Task.perform(main())
