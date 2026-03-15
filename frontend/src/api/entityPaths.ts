export type CollectionPath = `/${string}/`

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function joinPath(...segments: Array<string | number>): string {
  const cleaned = segments
    .map((segment) => trimSlashes(String(segment)))
    .filter(Boolean)
  return `/${cleaned.join('/')}/`
}

export function itemPath(collection: CollectionPath, id: string | number): string {
  return joinPath(collection, id)
}

export function collectionActionPath(collection: CollectionPath, action: string): string {
  return joinPath(collection, action)
}

export function itemActionPath(
  collection: CollectionPath,
  id: string | number,
  action: string,
): string {
  return joinPath(collection, id, action)
}
