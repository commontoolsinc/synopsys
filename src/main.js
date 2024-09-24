import { Task } from './lib.js'
import * as HTTP from './http.js'
import * as Service from './service.js'

/**
 * @typedef {object} Options
 * @property {number} [port]
 * @property {string} [store]
 *
 * @param {Options} options
 */
export const main = async ({
  port = Number(process.env.PORT ?? 8080),
  store = process.env.STORE ?? '../service-store',
} = {}) => {
  const url = new URL(store, import.meta.url)
  const service = await Task.perform(Service.open(url))
  const socket = await HTTP.listen({ port })
  console.log(`Listening ${HTTP.endpoint(socket).href}`)
  for await (const event of HTTP.open(socket)) {
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
        const promise = Task.perform(Service.subscribe(service, event.request))
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
}

main()
