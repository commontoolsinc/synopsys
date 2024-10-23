import * as Type from './type.js'
import { promise } from './sync.js'
import { Task } from 'datalogia'
import { of as refer } from '../datum/reference.js'

/**
 * @template {Type.Selector} [Select=Type.Selector]
 * @typedef {object} Options
 * @property {Type.Query<Select>} query
 * @property {ReadableStream<Type.Selection<Select>[]>} source
 */

/**
 * Open a subscription for the given query source.
 *
 * @template {Type.Selector} [Select=Type.Selector]
 * @param {Options<Select>} options
 */
export const open = function* ({ query, source }) {
  // const subscription = new SubscriptionView({
  //   status: 'idle',
  //   source,
  //   reader: source.getReader(),
  //   query,
  //   subscribers: new Set(),
  //   revision: refer([]),
  // })

  // yield* Task.fork(activate(subscription))

  // return subscription
  return new SubscriptionStream(undefined, undefined, { query, source })
}

// const read = new ReadableStream()

/**
 * @template {Type.Selector} [Select=Type.Selector]
 * @implements {Type.Subscription<Select>}
 * @extends {ReadableStream<Type.Selection<Select>[]>}
 */
class SubscriptionStream extends ReadableStream {
  /**
   *
   * @param {undefined} _source
   * @param {undefined} _strategy
   * @param {Options<Select>} options
   */
  constructor(_source, _strategy, { query, source }) {
    super({
      pull: async (controller) => {
        try {
          const next = await this.reader.read()
          if (next.done) {
            controller.close()
          } else {
            controller.enqueue(next.value)
          }
        } catch (error) {
          controller.error(error)
        }
      },
      cancel: () => {
        this.reader.cancel()
      },
    })
    this.reader = source.getReader()
    this.query = query
  }
  *poll() {
    const reader = this.getReader()
    const next = yield* Task.wait(reader.read())
    reader.releaseLock()
    if (!next.done) {
      return next.value
    } else {
      throw new Error(`Subscription is closed`)
    }
  }
}

// /**
//  * Data model for the subscription state.
//  *
//  * @template {Type.Selector} [Select=Type.Selector]
//  * @typedef {object} Subscription
//  * @property {Type.Query<Select>} query - The query for the subscription.
//  * @property {'idle'|'active'} status
//  * @property {Set<Type.SignalController<IteratorResult<Type.Selection<Select>[]>>>} subscribers - Set of active consumers for
//  * this subscription.
//  * @property {Type.Reference} revision
//  * @property {ReadableStream<Type.Selection<Select>[]>} source
//  * @property {ReadableStreamDefaultReader<Type.Selection<Select>[]>} reader
//  */

// /**
//  * Task receives data on the `subscription.source` and broadcasts it all the
//  * active subscribers. It also takes care of omitting updates if they are
//  * identical to the previous ones.
//  *
//  * @template {Type.Selector} [Select=Type.Selector]
//  * @param {Subscription<Select>} subscription
//  */
// export function* activate(subscription) {
//   if (subscription.status === 'idle') {
//     subscription.status = 'active'
//     const { reader, subscribers } = subscription
//     while (subscribers.size > 0) {
//       const next = yield* Task.wait(reader.read())
//       if (!next.done) {
//         const selection = next.value
//         const revision = refer(selection)

//         if (subscription.revision.toString() !== revision.toString()) {
//           subscription.revision = revision

//           // Go over each iterator, if iterator is active propagate new state
//           // otherwise remove the iterator from the set.
//           const [...subscribers] = subscription.subscribers
//           subscription.subscribers.clear()
//           for (const subscriber of subscribers) {
//             subscriber.send({ done: false, value: selection })
//           }
//         }
//       } else {
//         for (const subscriber of subscribers) {
//           subscriber.send({ done: true, value: undefined })
//         }
//         subscribers.clear()
//       }
//     }
//     subscription.status = 'idle'
//   }
// }

// /**
//  * @param {Subscription} subscription
//  */
// export function* cancel(subscription) {
//   yield* Task.wait(subscription.reader.cancel())
// }

// /**
//  * @template {Type.Selector} [Select=Type.Selector]
//  * @param {Subscription<Select>} subscription
//  * @param {Type.SignalController<IteratorResult<Type.Selection<Select>[]>>} subscriber
//  */
// function* enqueue(subscription, subscriber) {
//   subscription.subscribers.add(subscriber)
//   yield* Task.fork(activate(subscription))
// }

// /**
//  * Creates an iterator for this subscription that concurrently can be used to
//  * receive updated results of the subscription.
//  *
//  * @template {Type.Selector} [Select=Type.Selector]
//  * @param {Subscription<Select>} subscription
//  */
// export const iterate = (subscription) => {
//   const controller = promise()
//   const subscriber = new Subscriber(subscription, controller)
//   Task.perform(enqueue(subscription, controller))

//   return subscriber
// }

// /**
//  * @template {Type.Selector} [Select=Type.Selector]
//  * @param {Subscription<Select>} subscription
//  */
// export function* poll(subscription) {
//   const subscriber = promise()
//   yield* enqueue(subscription, subscriber)
//   return yield* Task.wait(subscriber.promise)
// }

// /**
//  * @template {Type.Selector} [Select=Type.Selector]
//  * @implements {Type.Subscription<Select>}
//  */
// class SubscriptionView {
//   #model
//   /**
//    * @param {Subscription<Select>} model
//    */
//   constructor(model) {
//     this.#model = model
//   }
//   get status() {
//     return this.#model.status
//   }
//   set status(value) {
//     this.#model.status = value
//   }
//   get query() {
//     return this.#model.query
//   }
//   get revision() {
//     return this.#model.revision
//   }
//   set revision(revision) {
//     this.#model.revision = revision
//   }

//   get source() {
//     return this.#model.source
//   }
//   get reader() {
//     return this.#model.reader
//   }

//   [Symbol.asyncIterator]() {
//     return iterate(this)
//   }

//   get subscribers() {
//     return this.#model.subscribers
//   }

//   poll() {
//     return poll(this)
//   }

//   cancel() {
//     return cancel(this)
//   }
// }

// /**
//  * @template {Type.Selector} [Select=Type.Selector]
//  * @implements {AsyncIterator<Type.Selection<Select>[]>}
//  */
// class Subscriber {
//   /**
//    * @param {Subscription<Select>} subscription
//    * @param {Type.PromiseController<IteratorResult<Type.Selection<Select>[]>>|null} state
//    */
//   constructor(subscription, state = promise()) {
//     this.subscription = subscription
//     this.state = state
//   }

//   /**
//    * @param {Error} error
//    */
//   abort(error) {
//     if (this.state) {
//       this.state.abort(error)
//       this.state = null
//     }
//   }

//   /**
//    * @returns {Promise<IteratorResult<Type.Selection<Select>[]>>}
//    */
//   async next() {
//     const { state } = this
//     if (state == null) {
//       return { done: true, value: undefined }
//     } else {
//       const next = await state.promise
//       if (next.done) {
//         this.state = null
//       } else {
//         const subscriber = promise()
//         this.state = subscriber
//         await Task.perform(enqueue(this.subscription, subscriber))
//       }

//       return next
//     }
//   }
//   /**
//    * @returns {Promise<IteratorResult<Type.Selection<Select>[]>>}
//    */
//   async return() {
//     const { state } = this
//     if (state != null) {
//       state.send({ done: true, value: undefined })
//       return await state.promise
//     } else {
//       return { done: true, value: undefined }
//     }
//   }
//   throw() {
//     return this.return()
//   }
// }
