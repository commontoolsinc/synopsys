import * as Type from '../replica/type.js'
import * as DAG from '../replica/dag.js'
import * as JSON from '@ipld/dag-json'
import { base64 } from 'multiformats/bases/base64'
import { Task } from 'datalogia'
import { get } from 'http'
import { refer } from '../datum/reference.js'
import { channel } from '../replica/sync.js'
import * as Sync from '../sync.js'

/**
 * @typedef {(request: Request) => Promise<Response>} Fetch
 *
 * @typedef {object} Connection
 * @property {URL} url
 * @property {Fetch} [fetch]
 */

/**
 * Opens a new remote session.
 *
 * @param {Connection} connection
 */
export const open = ({ url, fetch = globalThis.fetch.bind(globalThis) }) =>
  RemoteSession.open({ url, fetch })

class RemoteSession {
  /**
   * @param {Required<Connection>} connection
   */
  static *open(connection) {
    const { readable, writable } = new TransformStream()
    const request = new Request(connection.url, {
      method: 'POST',
      // @ts-expect-error - `duplex` is required but TS does not seem to
      // know of it.
      duplex: 'half',
      headers: {
        accept: Sync.contentType,
      },
      body: readable,
    })

    const response = yield* Task.wait(connection.fetch(request))
    if (response.status !== 200 || !response.body) {
      throw new Error('Failed to open session')
    }

    const session = new RemoteSession({ readable: response.body, writable })
    Task.perform(session.poll())

    return session
  }

  /**
   * @param {object} channel
   * @param {ReadableStream<Uint8Array>} channel.readable
   * @param {WritableStream<Uint8Array>} channel.writable
   */
  constructor({ readable, writable }) {
    this.readable = readable
    this.writable = writable
    this.writer = writable.getWriter()
    this.reader = readable.getReader()

    this.cause = refer({})
    /** @type {Map<string, Type.Channel<unknown, Error>>} */
    this.ports = new Map()
  }
  *poll() {
    while (true) {
      const { done, value } = yield* Task.wait(this.reader.read())
      if (done) {
        break
      }

      const { cause, result } = /** @type {Sync.Outcome} */ (
        yield* DAG.decode(JSON, value)
      )

      const port = this.ports.get(cause.toString())
      if (port) {
        this.ports.delete(cause.toString())
        if (result.ok !== undefined) {
          port.write(result.ok)
        } else {
          port.cancel(/** @type {Error} */ (result.error))
        }
        port.write(result)
      } else {
        throw new Error('Received result for unknown command')
      }
    }
  }
  /**
   * @param {Partial<Sync.Command>} command
   * @returns {Task.Task<any, Error>}
   */
  *perform(command) {
    const request = { ...command, cause: this.cause }
    const port = channel()
    const id = refer(request)

    this.ports.set(id.toString(), port)
    this.cause = id

    this.writer.write(yield* DAG.encode(JSON, request))

    return yield* port.read()
  }

  /**
   * @returns {Task.Task<Type.Node, Error>}
   */
  getRoot() {
    return this.perform({ getRoot: { cause: this.cause } })
  }
  /**
   * @param {number} level
   * @param {Uint8Array} key
   * @returns {Task.Task<Type.Node|null, Error>}
   */
  getNode(level, key) {
    return this.perform({ getNode: { level, key, cause: this.cause } })
  }
  /**
   * @param {number} level
   * @param {Uint8Array} key
   * @returns {Task.Task<Type.Node[], Error>}
   */
  getChildren(level, key) {
    return this.perform({ getChildren: { level, key, cause: this.cause } })
  }

  /**
   * @param {Type.Change[]} changes
   * @returns {Task.Task<Type.Node, Error>}
   */
  integrate(changes) {
    return this.perform({ integrate: { changes, cause: this.cause } })
  }
}
