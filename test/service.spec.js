import * as DB from 'datalogia'
import * as Store from 'synopsys/store/memory'
import * as Blobs from 'synopsys/blob/memory'
import { Task, Replica, refer, $ } from 'synopsys'
import * as Service from 'synopsys/service'

/**
 * @type {import('entail').Suite}
 */
export const testService = {
  'options request': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const options = yield* Service.fetch(
        service,
        new Request('https://localhost:8080', { method: 'OPTIONS' })
      )

      assert.equal(options.status, 204)
      assert.equal(options.headers.get('Access-Control-Allow-Origin'), '*')
      assert.equal(
        options.headers.get('Access-Control-Allow-Methods'),
        'GET, POST, PUT, PATCH'
      )
      assert.equal(
        options.headers.get('Access-Control-Allow-Headers'),
        'Content-Type'
      )

      yield* Service.close(service)
    }),
  'patch transacts data': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const counter = refer({ counter: {} })

      const patch = yield* Service.fetch(
        service,
        new Request('https://localhost:8080', {
          method: 'PATCH',
          body: JSON.stringify([{ Assert: [counter, 'count', 1] }]),
        })
      )

      assert.equal(patch.status, 200)
      const result = yield* Task.wait(patch.json())

      assert.equal(typeof result.ok.before.id, 'string')
      assert.equal(typeof result.ok.after.id, 'string')
    }),
  'unsupported method': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const unsupported = yield* Service.fetch(
        service,
        new Request('https://localhost:8080', { method: 'DELETE' })
      )

      assert.equal(unsupported.status, 405)
      assert.equal(unsupported.statusText, 'Method Not Allowed')
      assert.deepEqual(yield* Task.wait(unsupported.json()), {
        error: { message: 'Method not allowed' },
      })
    }),
  'GET /': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const get = yield* Service.fetch(
        service,
        new Request('https://localhost:8080')
      )

      assert.equal(get.status, 404)
      assert.equal(get.headers.get('Content-Type'), 'application/json')
      assert.deepEqual(yield* Task.wait(get.json()), {
        ok: {},
      })
    }),

  'GET /jibberish': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const get = yield* Service.fetch(
        service,
        new Request('https://localhost:8080/jibberish')
      )

      assert.equal(get.status, 404)
      assert.equal(get.headers.get('Content-Type'), 'application/json')
      assert.deepEqual(yield* Task.wait(get.json()), {
        error: { message: `Query jibberish was not found` },
      })
    }),
  'rejects invalid query': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const put = yield* Service.fetch(
        service,
        new Request('https://localhost:8080', {
          method: 'PUT',
          body: JSON.stringify({ id: 'NcuV3vKyQgcxiZDMdE37fv' }),
        })
      )

      assert.equal(put.status, 400)
      assert.equal(put.statusText, 'Invalid query')
      assert.deepEqual(yield* Task.wait(put.json()), {
        error: {
          message: `Invalid query, 'where' field must be an array of clause, instead got 'undefined'`,
        },
      })
    }),
  'saves good query': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const put = yield* Service.fetch(
        service,
        new Request('http://localhost:8080', {
          method: 'PUT',
          body: JSON.stringify({
            select: {
              queries: ['?query'],
            },
            where: [{ Case: [Replica.synopsys, 'db/query', '?query'] }],
          }),
        })
      )

      assert.equal(put.status, 303, 'redirects to the query')
      assert.equal(
        put.headers.get('Location'),
        `http://localhost:8080/ba4jcbkpzhfmtjxocg7ztwchbgzzjabb36wko2iqzlpikhlrga2cttoef`
      )

      const found = yield* DB.query(service.data, {
        select: { query: $.query },
        where: [{ Case: [Replica.synopsys, 'synopsys/query', $.query] }],
      })

      assert.deepEqual(
        found.map(({ query }) => query.toString()),
        ['ba4jcbkpzhfmtjxocg7ztwchbgzzjabb36wko2iqzlpikhlrga2cttoef'],
        'query was stored to database'
      )
    }),
  'returns event source when getting query': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const put = yield* Service.fetch(
        service,
        new Request('http://localhost:8080', {
          method: 'PUT',
          body: JSON.stringify({
            select: {
              query: '?query',
            },
            where: [{ Case: [Replica.synopsys, 'synopsys/query', '?query'] }],
          }),
        })
      )

      assert.equal(put.status, 303, 'redirects to the query')
      const location = put.headers.get('Location') ?? ''

      const get = yield* Service.fetch(service, new Request(location))
      assert.equal(get.status, 200)
      assert.equal(get.headers.get('Content-Type'), 'text/event-stream')

      const body = /** @type {ReadableStream<Uint8Array>} */ (get.body)
      const reader = body.getReader()
      const chunk = yield* Task.wait(reader.read())
      const content = new TextDecoder().decode(chunk?.value)

      assert.equal(
        content,
        `id:ba4jcar6m52gciau3ojzfrbjgnkzlsl6u3at4eeohtj2qsredkcxeahgh
event:change
data:[{"query":{"/":"baedreigpx7y7rjahspwuhq2nu4rdgv2y5omzmktwf5eb3ybqk5fqundvmy"}}]\n\n`
      )

      yield* Task.wait(reader.cancel())
      yield* Task.sleep(0)

      assert.deepEqual(service.subscriptions.size, 0, 'subscription is closed')

      assert.equal(
        Object(service.replica).subscriptions.size,
        0,
        'subscriptions are also closed'
      )

      const retry = yield* Service.fetch(service, new Request(location))
      assert.equal(retry.status, 200, 'still got new event source')
      assert.equal(retry.headers.get('Content-Type'), 'text/event-stream')
    }),
  'fails to find query': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const get = yield* Service.fetch(
        service,
        new Request(
          'http://localhost:8080/ba4jcbkpzhfmtjxocg7ztwchbgzzjabb36wko2iqzlpikhlrga2cttoef'
        )
      )
      assert.equal(get.status, 404)
      assert.equal(get.headers.get('Content-Type'), 'application/json')
      assert.deepEqual(yield* Task.wait(get.json()), {
        error: {
          message: `Query ba4jcbkpzhfmtjxocg7ztwchbgzzjabb36wko2iqzlpikhlrga2cttoef was not found`,
        },
      })
    }),

  'concurrent subscriptions': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open({
        data: yield* Store.open(),
        blobs: yield* Blobs.open(),
      })

      const put = yield* Service.fetch(
        service,
        new Request('http://localhost:8080', {
          method: 'PUT',
          body: JSON.stringify({
            select: {
              count: '?count',
            },
            where: [
              { Case: [refer({ counter: {} }), 'counter/count', '?count'] },
            ],
          }),
        })
      )

      assert.equal(put.status, 303, 'redirects to the query')
      const location = put.headers.get('Location') ?? ''

      const get = yield* Service.fetch(service, new Request(location))
      assert.equal(get.status, 200)
      assert.equal(get.headers.get('Content-Type'), 'text/event-stream')

      const body = /** @type {ReadableStream<Uint8Array>} */ (get.body)
      const reader = body.getReader()
      const chunk = yield* Task.wait(reader.read())
      const content = new TextDecoder().decode(chunk?.value)

      assert.equal(
        content,
        `id:ba4jca7pcf7obj4jijrrgmgzo642qydb7cstlwpv7vf7oudqyrpwhowxx
event:change
data:[]\n\n`
      )

      const concurrent = yield* Service.fetch(service, new Request(location))
      assert.equal(concurrent.status, 200, 'still got new event source')
      assert.equal(concurrent.headers.get('Content-Type'), 'text/event-stream')
      assert.equal(get.status, 200)
      assert.equal(get.headers.get('Content-Type'), 'text/event-stream')

      yield* DB.transact(service.replica, [
        { Assert: [refer({ counter: {} }), 'counter/count', 1] },
      ])

      {
        const body = /** @type {ReadableStream<Uint8Array>} */ (concurrent.body)
        const reader = body.getReader()

        const chunk = yield* Task.wait(reader.read())
        const content = new TextDecoder().decode(chunk?.value)

        assert.equal(
          content,
          `id:ba4jcapk7kku4u32tw7sx63wuup2glg2wqspvo356b62k3bzwcfcntdwt
event:change
data:[{"count":1}]\n\n`
        )
      }
    }),
}
