import * as Set from '../src/causal/set.js'
import { Task, refer, Type } from 'synopsys'

/**
 * @type {import('entail').Suite}
 */
export const testCausalSet = {
  basic: (assert) => {
    const one = Set.create(1).build()

    assert.deepEqual(one, [{ head: 1, cause: [] }])

    const two = Set.create(1).assert(2).build()

    assert.deepEqual(two, [{ head: 2, cause: [refer({ head: 1, cause: [] })] }])
  },

  'merge diverged replicas': (assert) => {
    const store = Set.store()
    const local = Set.builder(store)
      .assert('A0')
      .assert('B1')
      .assert('C1')
      .build()
    const remote = Set.builder(store)
      .assert('A0')
      .assert('B2')
      .assert('C2')
      .assert('D2')
      .build()

    const merged = Set.merge(local, remote, store)

    assert.deepEqual(merged, [
      {
        head: 'C1',
        cause: [
          refer({ head: 'B1', cause: [refer({ head: 'A0', cause: [] })] }),
        ],
      },
      {
        head: 'D2',
        cause: [
          refer({
            head: 'C2',
            cause: [
              refer({ head: 'B2', cause: [refer({ head: 'A0', cause: [] })] }),
            ],
          }),
        ],
      },
    ])
  },

  'linearize set': (assert) => {
    const store = Set.store()
    const local = Set.builder(store)
      .assert('A0')
      .assert('B1')
      .assert('C1')
      .build()
    const remote = Set.builder(store)
      .assert('A0')
      .assert('B2')
      .assert('C2')
      .assert('D2')
      .build()

    const merged = Set.merge(local, remote, store)

    const [...members] = Set.iterate(merged, store)
    assert.deepEqual(members, [
      [
        0,
        refer({
          head: 'C1',
          cause: [
            refer({ head: 'B1', cause: [refer({ head: 'A0', cause: [] })] }),
          ],
        }),
      ],
      [
        0,
        refer({
          head: 'D2',
          cause: [
            refer({
              head: 'C2',
              cause: [
                refer({
                  head: 'B2',
                  cause: [refer({ head: 'A0', cause: [] })],
                }),
              ],
            }),
          ],
        }),
      ],
      [1, refer({ head: 'B1', cause: [refer({ head: 'A0', cause: [] })] })],
      [
        1,
        refer({
          head: 'C2',
          cause: [
            refer({
              head: 'B2',
              cause: [refer({ head: 'A0', cause: [] })],
            }),
          ],
        }),
      ],
      [2, refer({ head: 'A0', cause: [] })],
      [2, refer({ head: 'B2', cause: [refer({ head: 'A0', cause: [] })] })],
    ])
  },

  'merge subset': (assert) => {
    const store = Set.store()
    const local = Set.merge(
      Set.builder(store).assert('A0').assert('B1').build(),
      Set.builder(store).assert('A0').assert('B2').assert('C2').build(),
      store
    )

    const remote = Set.merge(
      Set.builder(store)
        .assert('A0')
        .assert('B1')
        .assert('C1')
        .assert('D1')
        .build(),
      Set.builder(store).assert('A0').assert('B2').assert('C2').build(),
      store
    )

    const merged = Set.merge(local, remote, store)
    assert.deepEqual(remote, merged)
  },

  'terminate when cause are resolved': (assert) => {
    const store = Set.store()
    const local = Set.merge(
      Set.builder(store).assert('A0').assert('B1').build(),
      Set.builder(store).assert('A0').assert('B2').assert('C2').build(),
      store
    )

    assert.deepEqual(local, [
      {
        head: 'B1',
        cause: [refer({ head: 'A0', cause: [] })],
      },
      {
        head: 'C2',
        cause: [
          refer({ head: 'B2', cause: [refer({ head: 'A0', cause: [] })] }),
        ],
      },
    ])

    const remote = Set.assert(
      Set.merge(
        Set.builder(store).assert('A0').assert('B1').build(),
        Set.builder(store).assert('A0').assert('B2').build(),
        store
      ).map(refer),
      'C3'
    )

    assert.deepEqual(remote, [
      {
        head: 'C3',
        cause: [
          refer({ head: 'B1', cause: [refer({ head: 'A0', cause: [] })] }),
          refer({ head: 'B2', cause: [refer({ head: 'A0', cause: [] })] }),
        ],
      },
    ])

    /** @type {Type.Reference[]} */
    const log = []
    /** @type {Set.Reader<Set.Causal<{}>>} */
    const reader = {
      read: (key) => {
        log.push(key)
        return store.read(key)
      },
    }

    const merged = Set.merge(local, remote, reader)
    assert.deepEqual(merged, [
      {
        head: 'B1',
        cause: [refer({ head: 'A0', cause: [] })],
      },
      {
        head: 'C3',
        cause: [
          refer({ head: 'B1', cause: [refer({ head: 'A0', cause: [] })] }),
          refer({ head: 'B2', cause: [refer({ head: 'A0', cause: [] })] }),
        ],
      },
      {
        head: 'C2',
        cause: [
          refer({ head: 'B2', cause: [refer({ head: 'A0', cause: [] })] }),
        ],
      },
    ])

    assert.deepEqual(
      log,
      [
        refer({
          head: 'B1',
          cause: [refer({ head: 'A0', cause: [] })],
        }),
        refer({
          head: 'C2',
          cause: [
            refer({ head: 'B2', cause: [refer({ head: 'A0', cause: [] })] }),
          ],
        }),
        refer({
          head: 'C3',
          cause: [
            refer({ head: 'B1', cause: [refer({ head: 'A0', cause: [] })] }),
            refer({ head: 'B2', cause: [refer({ head: 'A0', cause: [] })] }),
          ],
        }),
        refer({ head: 'B2', cause: [refer({ head: 'A0', cause: [] })] }),
        refer({ head: 'B1', cause: [refer({ head: 'A0', cause: [] })] }),
      ],
      'did not read "A0" because all causes were found'
    )
  },
}
