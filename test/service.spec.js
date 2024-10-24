import * as DB from 'datalogia'
import { Task, Agent, refer, variable } from 'synopsys'
import * as Service from 'synopsys/service'
import * as Reference from '../src/datum/reference.js'
import { read } from 'fs'

/**
 * @type {import('entail').Suite}
 */
export const testService = {
  'options request': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open(new URL('memory:'))

      const options = yield* Service.request(
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
  'rejects invalid query': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open(new URL('memory:'))

      const put = yield* Service.request(
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
      const service = yield* Service.open(new URL('memory:'))

      const put = yield* Service.request(
        service,
        new Request('http://localhost:8080', {
          method: 'PUT',
          body: JSON.stringify({
            select: {
              queries: ['?query'],
            },
            where: [{ Case: [Agent.synopsys, 'db/query', '?query'] }],
          }),
        })
      )

      assert.equal(put.status, 303, 'redirects to the query')
      assert.equal(
        put.headers.get('Location'),
        `http://localhost:8080/ba4jcavoloncqccqzve7pvmge4rb3sicm5ck54ov5wfc2el4of7ersvoo`
      )

      const query = Agent.variable()
      const found = yield* DB.query(service.source, {
        select: { query },
        where: [{ Case: [Agent.synopsys, 'synopsys/query', query] }],
      })

      assert.deepEqual(
        found.map(({ query }) => query.toString()),
        ['ba4jcavoloncqccqzve7pvmge4rb3sicm5ck54ov5wfc2el4of7ersvoo'],
        'query was stored to database'
      )
    }),
  'only returns event source when getting query': (assert) =>
    Task.spawn(function* () {
      const service = yield* Service.open(new URL('memory:'))

      const put = yield* Service.request(
        service,
        new Request('http://localhost:8080', {
          method: 'PUT',
          body: JSON.stringify({
            select: {
              query: '?query',
            },
            where: [{ Case: [Agent.synopsys, 'synopsys/query', '?query'] }],
          }),
        })
      )

      assert.equal(put.status, 303, 'redirects to the query')
      const location = put.headers.get('Location') ?? ''

      const get = yield* Service.request(service, new Request(location))
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

      console.log(service.agent.toJSON())
    }),
}
