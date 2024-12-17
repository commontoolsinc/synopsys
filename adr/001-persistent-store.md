# Persistent Store

## Status

implemented

## Context

We need a store where facts / datums could be persisted by [datalogia] engine across sessions. Store needs to provide efficient range scan for the pattern `[?entity ?attribute ?value]` in which some members are known.

## Decision

An [Okra] key-value store was chosen for following reasons:

1. It implements [Prolly Tree](https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html) over arbitrary key value store and is oriented towards efficient sync.
1. It has several underlying backends including [LMDB](https://github.com/canvasxyz/okra-js/tree/main/packages/okra-lmdb) and [IDB](https://npmjs.com/package/@canvas-js/okra-idb).
1. It is designed with pluggable backends in mind, so we could implement our own.
1. [Prolly Tree] being a markle tree gives us hash identifier for the DB state.
1. We can always switch to something else, but this seems like a good fit for a first implementation. 

## Consequences

By choosing [Okra] we implicitly choose JS which may not be an ideal choice long term. However in the current phase of the development ability to use [datalogia] and abilityt prototype quickly is more important than a choice that will serve us long term.

[prolly tree]:https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html
[Okra]:https://github.com/canvasxyz/okra-js
[datalogia]:https://github.com/gozala/datalogia
