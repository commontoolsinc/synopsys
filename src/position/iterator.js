export const entries = Object.assign(
  /**
   * @template T
   * @param {ArrayLike<T>} source
   * @returns {Iterable<[number, T]>}
   */
  function* entries(source) {
    for (let offset = 0; offset < source.length; offset++) {
      yield [offset, source[offset]]
    }
  },
  {
    /**
     * @template T
     * @param {ArrayLike<T>} source
     */
    *reverse(source) {
      for (let offset = source.length - 1; offset >= 0; offset--) {
        yield [offset, source[offset]]
      }
    },
  }
)

export const values = Object.assign(
  /**
   * @template T
   * @param {Iterable<T>} source
   */
  function* (source) {
    for (const value of source) {
      yield value
    }
  },
  {
    /**
     * @template T
     * @param {ArrayLike<T>} source
     */
    reverse: function* (source) {
      for (let offset = source.length - 1; offset >= 0; offset--) {
        yield source[offset]
      }
    },
  }
)
