import * as Sync from '../src/replica/sync.js'
import { Task } from 'synopsys'

/**
 * @type {import('entail').Suite}
 */
export const testSync = {
  'test channel': (assert) =>
    Task.spawn(function* () {
      const channel = Sync.channel()

      const first = channel.read()
      channel.write(1)

      assert.deepEqual(yield* first, 1)

      const second = channel.read()

      channel.cancel(new Error('done'))

      const result = yield* Task.result(second)
      assert.ok(Object(result.error)?.reason, new Error('done'))
    }),

  'test transform': async (assert) => {
    const { readable, writable } = new TransformStream()
    const counts = Sync.transform(readable, {
      *init() {
        return [0, [0]]
      },
      *step(state, input) {
        return [state + input, [state + input]]
      },
      *close(state) {
        return [-state]
      },
    })

    const writer = writable.getWriter()
    writer.write(1)
    writer.write(2)
    writer.close()

    const collected = []
    for await (const n of counts) {
      collected.push(n)
    }

    assert.deepEqual(collected, [0, 1, 3, -3])
  },
  'test broadcast': async (assert) => {
    const { readable, writable } = new TransformStream()
    const hub = Sync.broadcast(readable)

    const writer = writable.getWriter()
    const first = collect(hub.fork())

    await writer.write(1)

    const second = collect(hub.fork())

    writer.write(2)

    writer.close()

    assert.deepEqual(await first, [{ ok: 1 }, { ok: 2 }])
    assert.deepEqual(await second, [{ ok: 2 }])
  },

  'cancel broadcast': async (assert) => {
    const { readable, writable } = new TransformStream()
    const hub = Sync.broadcast(readable)

    const writer = writable.getWriter()
    const first = collect(hub.fork())

    await writer.write(1)

    const second = collect(hub.fork())

    writer.write(2)

    writer.abort(new Error('Terminate'))

    assert.deepEqual(await first, [
      { ok: 1 },
      { ok: 2 },
      { error: new Error('Terminate') },
    ])
    assert.deepEqual(await second, [
      { ok: 2 },
      { error: new Error('Terminate') },
    ])
  },
}

/**
 * @template T
 * @param {ReadableStream<T>} stream
 */
const collect = async (stream) => {
  const chunks = []
  try {
    for await (const chunk of stream) {
      chunks.push({ ok: chunk })
    }
  } catch (error) {
    chunks.push({ error: Object(error).reason })
  }
  return chunks
}
