import * as Codec from '../src/codec.js'
import { refer } from 'synopsys'

/** @type {import('entail').Suite} */
export const testCodec = {
  'encodes transaction': async (assert) => {
    const { readable: source, writable } = new TransformStream()
    const encoded = Codec.encode(source)
    const readable = Codec.decode(encoded)

    const writer = writable.getWriter()
    const reader = readable.getReader()
    await writer.write([
      { Assert: [refer(1), 'test/attr', 1] },
      { Retract: [refer(2), 'some/thing', refer(1)] },
      { Upsert: [refer(3), 'another/thing', refer(1)] },
    ])

    const { value, done } = await reader.read()
    assert.deepEqual(value, [
      { Retract: [refer(2), 'some/thing', refer(1)] },
      { Assert: [refer(1), 'test/attr', 1] },
      { Upsert: [refer(3), 'another/thing', refer(1)] },
    ])

    await writer.close()
  },
}
