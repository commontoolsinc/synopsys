import * as Major from './major.js'
import * as Minor from './minor.js'
import * as Patch from './patch.js'
import * as Digits from './digits.js'

/**
 * @typedef {Digits.Digits<Digits.B62>} Position
 */

const BLANK = /** @type {Patch.Patch} */ (new Uint8Array())

/**
 * @param {Major.Major} major
 * @param {Minor.Minor} minor
 * @param {Patch.Patch} patch
 * @returns {Position}
 */
const create = (major, minor = BLANK, patch = BLANK) => {
  // Remove trailing min values from patch component.
  patch = Patch.trim(patch)
  // If patch is empty also trim trailing min values from minor component.
  minor = patch.length === 0 ? Minor.trim(minor) : minor

  const position = new Uint8Array(1 + minor.length + patch.length)
  position[0] = major
  position.set(minor, 1)
  position.set(patch, 1 + minor.length)

  return /** @type {Position} */ (position)
}

/**
 * @param {Uint8Array} bias
 * @param {Position} position
 * @returns {Position}
 */
export const before = (bias, position) => {
  const beforeMajor = Major.from(position)
  const beforeMinor = Minor.from(position)

  // We attempt to decrement minor component first.
  const minor = Minor.decrement(beforeMinor)
  // If we have not run out of space for minor component we simply
  // need to create position with the same major component and decremented
  // minor component.
  if (minor) {
    return create(beforeMajor, minor, bias)
  }
  // However minor component may be at min value.
  else {
    // In that case we attempt to decrement major component.
    const major = Major.decrement(beforeMajor)
    // If major is not at it's min value we can simply create a new position
    // with it and leave out minor and patch components which implicitly will
    // be at their min values.
    if (major) {
      const minor = Minor.max(Major.capacity(major))
      return create(major, minor, bias)
    }
    // However we are at min major our only option left is to decrement patch
    // component and create a new position with the same major and minor.
    else {
      // Attempt to decrement patch component.
      const patch = Patch.decrement(Patch.from(position), bias)
      // If we managed to decrement patch component we can create a new position
      // with the same major and minor components and decremented patch component.
      if (patch) {
        return create(beforeMajor, beforeMinor, patch)
      }
      // However if  patch component is at min value there is simply no position
      // in the supported range that would sort before `before` position, therefore
      // we return the same `before` position.
      else {
        return Digits.trim(position, Minor.base.ranges)
      }
    }
  }
}

/**
 * @param {Uint8Array} bias
 * @param {Position} position
 * @returns {Position}
 */
export const after = (bias, position) => {
  const afterMajor = Major.from(position)
  const afterMinor = Minor.from(position)
  // We first attempt to increment minor component.
  const minor = Minor.increment(afterMinor)
  // If we have not run out of space for minor component we simply
  // need to create position with the same major component and incremented
  // minor component.
  if (minor) {
    return create(afterMajor, minor, bias)
  }
  // However minor component may be at max value.
  else {
    // In that case we attempt to increment major component.
    const major = Major.increment(afterMajor)
    // If major is not at it's max value we can simply create a new position
    // with it and leave out minor and patch components which implicitly will
    // be at their minimum values.
    if (major) {
      return create(major, Minor.min(Major.capacity(major)), bias)
    }
    // However we are at max major our only option left is to increment patch
    // component and create a new position with the same major and minor.
    else {
      // Note that patch can always increment because it simply resizes to
      // accommodate larger values.
      return create(
        afterMajor,
        afterMinor,
        Patch.increment(Patch.from(position), bias)
      )
    }
  }
}

/**
 * @param {Uint8Array} bias
 * @param {Position} low
 * @param {Position} high
 * @returns {Position}
 */
export const between = (bias, low, high) => {
  const lowMajor = Major.from(low)
  const highMajor = Major.from(high)
  const lowMinor = Minor.from(low)
  const highMinor = Minor.from(high)

  // Attempt to find the intermediate major.
  const major = Major.intermediate(lowMajor, highMajor)
  switch (major) {
    // When majors are equal we attempt to find intermediate minor.
    case Major.EQUAL: {
      const minor = Minor.intermediate(lowMinor, highMinor)
      switch (minor) {
        // When minors are also equal we look for intermediate patch.
        case Minor.EQUAL: {
          const patch = Patch.intermediate(
            Patch.from(low),
            Patch.from(high),
            bias
          )
          // If patches are also equal there is no `position` between `low` and
          // `high` so we simply return `low` (`high` should be equal to `low`).
          return patch ? create(lowMajor, lowMinor, patch) : low
        }
        // When minors are consecutive we look for the next patch and create a
        // position. Note that we can always find next patch because they are
        // not bound in size.
        case Minor.CONSECUTIVE: {
          // If high has a patch then high without patch will be a more compact
          // position between low and high.
          let patch = Patch.decrement(Patch.from(high), bias)
          if (patch) {
            return create(highMajor, highMinor)
          }

          // If we could not trip the patch we could append to a patch in the
          // low position
          patch = Patch.next(Patch.from(low), bias)
          return create(lowMajor, lowMinor, patch)
        }
        // When intermediate minor is found we construct new position with it.
        default: {
          return create(lowMajor, minor, bias)
        }
      }
    }
    // When majors are consecutive
    case Major.CONSECUTIVE: {
      // Attempt to increment low minor. However it may already have max
      // value e.g. when `low` is `Zz`.
      let minor = Minor.increment(lowMinor)
      if (minor) {
        return create(lowMajor, minor, bias)
      }

      // If we can not increment `low` minor, we try to decrement `high` minor.
      // However it may already have a min value e.g. when `high` is `a0`.
      minor = Minor.decrement(highMinor)
      if (minor) {
        return create(highMajor, minor, bias)
      }

      // If high has a patch then high without patch will be a more compact
      // position between low and high.
      let patch = Patch.decrement(Patch.from(high), bias)
      if (patch) {
        return create(highMajor, highMinor, patch)
      }

      // If we were not able to neither increment nor decrement we resort to
      // increasing a `low` patch. That always works because patches aren't
      // fixed in size so we can always find a next one.
      patch = Patch.next(Patch.from(low), bias)
      return create(lowMajor, lowMinor, patch)
    }
    // When intermediate major is found we construct new position with just a
    // major.
    default: {
      return create(major, Minor.min(Major.capacity(major)), bias)
    }
  }
}

/**
 * @param {Uint8Array} bias
 * @param {object} at
 * @param {Position} [at.after]
 * @param {Position} [at.before]
 */
export const insert = (bias, at = {}) => {
  if (at.before != null && at.after != null) {
    return between(bias, at.after, at.before)
  } else if (at.before != null) {
    return before(bias, at.before)
  } else if (at.after != null) {
    return after(bias, at.after)
  } else {
    // We do not need to specify minor part because 0s are implicit.
    return create(Major.zero())
  }
}
