# Synopsys

> ## ⚠️ Suspended
>
> Development is suspended, any use of this code is at your own risk. If you're intereseted in this you may want to chechout [datalogia](https://github.com/gozala/datalogia).

Synopsys is proof of concept datastore service. It stores facts in terms of entity attribute value triples and allows clients to subscribe to _(datomic inspired)_ queries pushing updates to them when new transactions affect results.

![image](./cover.png)

## Usage

### Start

You can start a storage service by running following command in your terminal

```
npm start
```

ℹ️ You can optionally configure port service is going to listen to and path where the data will be persisted via `PORT` and `STORE` environment variables.

```
PORT=8080 STORE=/tmp/synopsys npm start
```

### Transact

You can submit transaction to the store via HTTP PATCH request in [DAG-JSON] format.

```js
const demoTransact = async (url = '///localhost:8080/') => {
  const groceries = {"/":"bafyr4iceqxmgq2pgahy5dkztvrqj65ljzebwpg6ytv6nio3ilyq6rymcy4"}
  const milk = {"/":"bafyr4ifmahtfsopilbtqutqsjjmbyfsid5nggvd7uozbceydeiwkpjs75y"}
  const eggs = {"/":"bafyr4ibll3abnnvtuk6uiakfogixv46r72p2s5lvtbkuqzyd2vfhl5t25u"}
  const bread = {"/":"bafyr4igxo65tssyr4y2wpkjxsphkmlxfnbhmesgusaboeagt5hiykq6xte"}

  const chores = {"/":"bafyr4iathncq5urfqnwbrg2xxudqxanmtmjqobcd2tdps7ogrnoz6su3bu"}
  const dishes = {"/":"bafyr4igg7h46r2koxaslitrd4uhkttfzgr55cm5kziajtrqvyvcqnu2mvq"}
  const laundry = {"/":"bafyr4iaafoljbvwcx4ogb5rftzpampyf7vw6ffgnqmffbu562hpoei676e"}


  const response = await fetch('///localhost:8080/', {
    method: 'PATCH',
    body: JSON.stringify([
      { Assert: [groceries, 'name', 'Groceries'] },
      { Assert: [groceries, 'todo', milk] },
      { Assert: [milk, 'title', 'Buy Milk'] },
      { Assert: [groceries, 'todo', eggs] },
      { Assert: [eggs, 'title', 'Buy Eggs'] },
      { Assert: [groceries, 'todo', bread] },
      { Assert: [bread, 'title', 'Buy Bread'] },
      { Assert: [bread, 'done', true] },
      { Assert: [chores, 'name', 'Chores'] },
      { Assert: [chores, 'todo', laundry] },
      { Assert: [laundry, 'title', 'Do Laundry'] },
      { Assert: [chores, 'todo', dishes] },
      { Assert: [dishes, 'title', 'Do Dishes'] },
    ])
  })

  return await response.json()
```

Running `demoTransact()` in your browser you should get commit info like the one below. It tells you what was the merkle root of the store before this transaction and what is it after.

```json
{ 
  "ok": {
    "before": { "id": "NcuV3vKyQgcxiZDMdE37fv" },
    "after": { "id": "Kize9wmtPCCVp1xL9wPPwd" }
  }
}
```

### Query

You can subscribe to a query and receive updates on transactions affecting it. To do that you can submit query via HTTP PUT request in [DAG-JSON] format. You will get a HTTP 303 redirect to the [`EventSource`] URL where updates will be delivered.

```js
const demoQuery = async function* (url = '///localhost:8080/') {
  const request = await fetch('///localhost:8080', {
    method: "PUT",
    body: JSON.stringify({
      select: {
        id: "?list",
        name: "?name",
        todo: [{
          "id": "?item",
          "title": "?title",
          "completed": "?done"
        }]
      },
      where: [
        { Case: ["?list", "name", "?name"] },
        { Case: ["?list", "todo", "?item"] },
        { Case: ["?item", "title", "?title"] },
        {
          Or: [
            { Case: ["?item", "done", "?done"] },
            {
              And: [
                { Not: { Case: ["?item", "done", "?done"] } },
                { "Is": ["?done", false] }
              ]
            }
          ]
        }
      ]
    })
  })

  const reader = request.body.getReader()
  const utf8 = new TextDecoder()
  while (true) {
    const read = await reader.read()
    if (read.done) {
      break
    } else {
      const [id, event, data] = 
        utf8.decode(read.value).split('\n')

      yield {
        id: id.slice('id:'.length),
        event: event.slice('event:'.length),
        data: JSON.parse(data.slice('data:'.length))
      }
    }
  }
}
```

ℹ️ You could also use [`EventSource`] API instead of following HTTP redirect. In that case you could pass `redirect: "manual"` to `fetch` request and then derive subscription URL locally from your query via `DB.Link.of(query)` function.

[DAG-JSON]:https://ipld.io/specs/codecs/dag-json/spec/
[`EventSource`]:https://developer.mozilla.org/en-US/docs/Web/API/EventSource
