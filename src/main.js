import { Task } from './lib.js'
import * as HTTP from './http.js'
import * as Service from './service.js'
import * as Store from './store.js'
import * as Blobs from './blob.js'
import * as Sync from './sync.js'
import process from 'node:process'
import { WebSocketServer } from 'ws'
import * as WS from './web-socket.js'
import * as FS from 'node:fs/promises'

export const KiB = 1024
export const MiB = KiB * 1024
export const GiB = MiB * 1024

/**
 * @typedef {object} Options
 * @property {number} [port]
 * @property {string} [store]
 * @property {number} [storeSize]
 *
 * @param {Options} options
 */
export const main = function* ({
  port = Number(process.env.PORT ?? 8080),
  storeSize = Number(process.env.STORE_SIZE ?? 4 * GiB - 1), // 4GiB causes LMDB error
  store = process.env.STORE ?? '../service-store/',
} = {}) {
  const url = new URL(store, import.meta.url)
  const data = yield* Store.open({
    url,
    mapSize: storeSize,
  })
  const file = yield* Task.wait(
    FS.open(new URL('./sync.synopsys', `${url}`), 'a+')
  )

  const sync = yield* Sync.open({ file })

  const service = yield* Service.open({
    store: data,
    blobs: yield* Blobs.open({
      url: new URL('./blobs/', `${url}`),
    }),
    sync,
  })

  try {
    const socket = yield* HTTP.listen({ port })
    const server = yield* Task.fork(serve(service, socket))
    console.log(`Listening ${HTTP.endpoint(socket)}`)

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

      const response = Task.perform(Service.fetch(service, event.request))
      event.respondWith(response)
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
