export const reverse = Object.assign(
  /**
   * @template T
   * @param {ArrayLike<T>} source
   * @returns {Iterable<[number, T]>}
   */
  function* reverse(source) {
    for (let offset = source.length - 1; offset >= 0; offset--) {
      yield [offset, source[offset]]
    }
  },
  {
    /**
     * @template T
     * @param {ArrayLike<T>} source
     * @returns {Iterable<T>}
     */
    *values(source) {
      for (let offset = source.length - 1; offset >= 0; offset--) {
        yield source[offset]
      }
    },
  }
)
