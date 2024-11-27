export default class Indexed<T> implements ArrayLike<T> {
  readonly [n: number]: T
  get length(): number {
    return 0
  }
}
