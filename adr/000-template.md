# Title

## Status

What is the status, such as proposed, accepted, rejected, deprecated, superseded, etc.?

## Context

Synopsys provides a reactive core for the CommonOS. It provides means of abstraction and composition through deductive and inductive rules system and takes care of orchestrating their execution and state propagation across the system consisting of local and remote replicas. Being at the center of everything has potential to address lot of complicated problems all at once, but it also makes it a critical piece therefor we need address mitigate the bus factor, so we can keep building it in parallel of building things on top of it. This document is an attempt to describe a grand vision along with various backoff strategies to mitigate risks.

### Loosely coupled components

Reactive system consists of various, fairly loosely coupled components so that they could be swapped out as needed. This is part of mitigation strategy e.g. if we're running into issue with persistence layer we could swap it out while keeping query engine as is at least for the layer above synopsys.

### Persistence

Long term vision is to use [ranked prolly tree] that provides key value store on top of hash addressed blob store which enables:

1. Partial on-demand replication.
1. Structural sharing across replicas / forks / branches.
1. Backend flexibility (S3, R2, Disk as long as you can read / write blobs).
1. Search without replication.
1. Address complete state via single hash.

While work on [ranked prolly tree] is ongoing we chose to use [okra](https://github.com/canvasxyz/okra-js) prolly tree, which is another persisted key value store which lacks all the above enablers but the last one.

#### Risk: Persistence requires Ranked Prolly Tree

There is a risk that production grade [ranked prolly tree] implementation will not be ready on schedule. All the other components assume pretty generic key value store with ability to perform a range scan. This enables us to choose any battle tested technology from embeddable [leveldb] to globally distributed [cloudflare key value store](https://developers.cloudflare.com/kv/).

### Replication

Long term vision of [ranked prolly tree] should give us on-demand replication. In the meantime we are using industry standard [event-sourcing pattern](https://en.wikipedia.org/wiki/Lambda_architecture) to replicate changes from backend to rest of the replicas.

#### Risk: Replication requires Ranked Prolly Tree

There is a risk that production grade [ranked prolly tree] implementation will not be ready on schedule. If so we can continue using [event-sourcing pattern](https://en.wikipedia.org/wiki/Lambda_architecture) to propagate changes from server to all the client replicas.

#### Risk: High data volume for the client

Unlike [ranked prolly tree] we do not get partial replication with event-sourcing, which can become a problem if the volume of data is too high for client to replicate. We do have options available if we face this:

1. Data is organized in collections which corresponds to collaboration / replication unit. We can be little more clever about correspondence between what's on the screen (needed for interactivity) and what's in the collection. This can be utilized to load / replicate data needed and reduce the volume.
1. Server can build occasional snapshots and consequently reduce amount of bytes needed for convergence.
1. If above two mitigations fail to address the problem we're likely misread target audience was which be a good moment to ponder whether what we are building is a right product for that audience. Yet we still have a way to mitigate this by running code we'd be running in the client in the remote instance (on backend) and remotely query it from client.

### Query Engine

Our query engine is based on declarative logic programming language [datalog](https://en.wikipedia.org/wiki/Datalog) which provides following benefits:

1. Designed for graph queries
1. Declarative means can be safely evaluated without sandbox-ing sub-system.
1. More expressive, yet simpler that SQL.
1. Allows schema on read semantics.

It is worth calling out that query engine is completely decoupled from replication and persistent components, it works with any data source conforming to a following interface:

```ts
export interface DataSource {
  query(where: {entity?: Uint8Array, attribute?: string, value?: Uint8Array}):
    Task<Iterable<[entity: Uint8Array, attribute: string, value: Uint8Array]>, Error>
}
```

#### Risk: Query re-evaluation is too slow

1. Current implementation is fairly naive and is in JS. We expect that by rewriting it in Rust it will be significantly faster.
1. [Differential update](https://github.com/Gozala/datalogia/issues/47) per [DBSP paper](https://arxiv.org/pdf/2203.16684) promises us a way to incrementally compute query results without having to re-evaluate them which we can implement.
1. [Datalog UI](https://datalogui.dev/) uses differential updates that we may be able to integrate.
1. Reduce data volume by more strategically sharding data across collections.
1. Reduce recursive queries.
1. Limit amount of joins in queries.
1. Forbid recursive queries.
1. Compile queries to SQL and query SQLite instead of KV.
   - Although reactivity may still require DBSP like things.

#### Risk: Give me documents not your semantic triples

1. Given a document schema we generate query so no need to worry about triples.
2.

#### Risk: Datalog is forgotten alien technology no one is familiar with

1. We sprinkle some sugar to make it look less alien.
   - Basic queries won't need much anyway, and if you're reaching for those means you'd be begging for it in document db.
1. We provide GraphQL interface instead (lot of graphdb seem to offer it).

#### Scheduler

## Decision

TBD

## Consequences

TBD

[ranked prolly tree]:https://github.com/commontoolsinc/system/tree/main/rust/ranked-prolly-tree
[leveldb]:https://github.com/google/leveldb
