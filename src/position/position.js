import * as Major from './major.js'
import * as Minor from './minor.js'
import * as Patch from './patch.js'

/**
 *
 * @param {Uint8Array} position
 * @param {Uint8Array} bias
 * @returns {Uint8Array}
 */
export const withBias = (position, bias) => position

const BLANK = new Uint8Array()

/**
 * @param {Major.Uint8} major
 * @param {Uint8Array} minor
 * @param {Uint8Array} patch
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

  return position
}

/**
 * @param {Uint8Array} bias
 * @param {Uint8Array} before
 */
export const insertBefore = (bias, before) => {
  const beforeMajor = Major.from(before)
  const beforeMinor = Minor.from(before)
  // We attempt to decrement minor component first.
  const minor = Minor.decrement(beforeMinor)
  // If we have not run out of space for minor component we simply
  // need to create position with the same major component and decremented
  // minor component.
  if (minor) {
    return withBias(create(beforeMajor, minor), bias)
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
      return withBias(create(major, minor), bias)
    }
    // However we are at min major our only option left is to decrement patch
    // component and create a new position with the same major and minor.
    else {
      // Attempt to decrement patch component.
      const patch = Patch.decrement(Patch.from(before))
      // If we managed to decrement patch component we can create a new position
      // with the same major and minor components and decremented patch component.
      if (patch) {
        return withBias(create(beforeMajor, beforeMinor, patch), bias)
      }
      // However if  patch component is at min value there is simply no position
      // in the supported range that would sort before `before` position, therefore
      // we return the same `before` position.
      else {
        return before
      }
    }
  }
}

/**
 * @param {Uint8Array} bias
 * @param {Uint8Array} after
 */
export const insertAfter = (bias, after) => {
  const afterMajor = Major.from(after)
  const afterMinor = Minor.from(after)
  // We first attempt to increment minor component.
  const minor = Minor.increment(afterMinor)
  // If we have not run out of space for minor component we simply
  // need to create position with the same major component and incremented
  // minor component.
  if (minor) {
    return withBias(create(afterMajor, minor), bias)
  }
  // However minor component may be at max value.
  else {
    // In that case we attempt to increment major component.
    const major = Major.increment(afterMajor)
    // If major is not at it's max value we can simply create a new position
    // with it and leave out minor and patch components which implicitly will
    // be at their minimum values.
    if (major) {
      return withBias(create(major), bias)
    }
    // However we are at max major our only option left is to increment patch
    // component and create a new position with the same major and minor.
    else {
      // Note that patch can always increment because it simply resizes to
      // accommodate larger values.
      const patch = Patch.increment(Patch.from(after))
      return withBias(create(afterMajor, afterMinor, patch), bias)
    }
  }
}

/**
 * @param {Uint8Array} bias
 * @param {Uint8Array} after
 * @param {Uint8Array} before
 */
export const insertBetween = (bias, after, before) => {
  const afterMajor = Major.from(after)
  const beforeMajor = Major.from(before)
  const major = Major.intermediate(afterMajor, beforeMajor)
  // If we found an intermediate major component we're done as that is only
  // component we'll need.
  if (major >= 0) {
    return withBias(create(major), bias)
  }
  // If we could not find an intermediate major component then two are
  // either consecutive or equal.
  else {
    const afterMinor = Minor.from(after)
    // If majors are equal we need to find intermediate minor component between
    // the two. If they are consecutive we can simply find an intermediate minor
    // between the `after` and a maximum minor component.
    const beforeMinor =
      major === beforeMajor
        ? Minor.from(before)
        : Minor.max(Major.capacity(beforeMajor))
    const minor = Minor.intermediate(afterMinor, beforeMinor)
    switch (minor) {
      // If minor components are equal, or consecutive we won't be able to
      // calculate the average of minor components. In such case we will pick
      // the minor component from `after`. And calculate the average between
      // patches.
      case Minor.EQUAL:
      case Minor.CONSECUTIVE: {
        const afterPatch = Patch.from(after)
        const beforePatch =
          // We use greater patch size in case low is all max values that
          // will ensure that minor will not return `null`.
          minor === Minor.CONSECUTIVE
            ? Patch.max(afterPatch.length + 1)
            : Patch.from(before)
        const patch = Patch.intermediate(afterPatch, beforePatch)
        // If `after` and `before` are the same there will be no intermediate
        // patch value so we'll have no other choice than use the same `after`
        // position.
        if (patch == null) {
          return after
        }
        // If `after` and `before` are consecutive we will find an intermediate
        // patch that will sort between them. In such case we construct position
        // with the same major and minor components and new consecutive patch
        // component.
        else {
          return create(afterMajor, afterMinor, patch)
        }
      }
      // If minor components were not consecutive we'll find an intermediate
      // minor component and will construct a new position with the same major
      // and consecutive minor component. Patch component will be empty since
      // new position will sort between `after` and `before` and we prefer
      // compact positions over precisely middle ones.
      default: {
        return withBias(create(afterMajor, minor), bias)
      }
    }
  }
}

/**
 * @param {Uint8Array} bias
 * @param {object} at
 * @param {Uint8Array} [at.after]
 * @param {Uint8Array} [at.before]
 */
export const insert = (bias, { after, before }) => {
  if (before != null && after != null) {
    return insertBetween(bias, after, before)
  } else if (before != null) {
    return insertBefore(bias, before)
  } else if (after != null) {
    return insertAfter(bias, after)
  } else {
    // We do not need to specify minor part because 0s are implicit.
    return create(Major.zero())
  }
}
