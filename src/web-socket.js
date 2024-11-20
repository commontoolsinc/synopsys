/**
 * @param {WebSocket|import('ws').WebSocket} socket
 */
export const toReadable = (socket) =>
  new ReadableStream({
    start(controller) {
      socket.addEventListener('message', (event) => {
        const body =
          event.data instanceof Uint8Array
            ? event.data
            : typeof event.data === 'string'
              ? new TextEncoder().encode(event.data)
              : event.data instanceof ArrayBuffer
                ? new Uint8Array(event.data)
                : new Blob(event.data).arrayBuffer()
        controller.enqueue(body)
        socket.addEventListener('close', () => {
          try {
            controller.close()
          } catch {}
        })
        socket.addEventListener('error', () => {
          try {
            controller.error()
          } catch {}
        })
      })
    },
  })

/**
 * @param {WebSocket|import('ws').WebSocket} socket
 * @returns {WritableStream<Uint8Array>}
 */
export const toWritable = (socket) =>
  new WritableStream({
    write(chunk) {
      socket.send(new TextDecoder().decode(chunk))
    },
    close() {
      socket.close()
    },
    abort(reason) {
      socket.close(1000, reason)
    },
  })

/**
 * @param {WebSocket|import('ws').WebSocket} socket
 */
export const from = (socket) => ({
  readable: toReadable(socket),
  writable: toWritable(socket),
})

export const WebSocket = globalThis.WebSocket
