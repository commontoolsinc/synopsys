/**
 * @template {import('datalogia').Entity} Entity
 * @param {Entity} entity
 * @returns {import('datalogia').ByteView<Entity>}
 */
export const toBytes = (entity) => entity['/']
