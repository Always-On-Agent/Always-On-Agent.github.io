/** The generated Arnis world is north-up: +X east, +Z south. */
export type MinimapPoint = { x: number; z: number }
export type MinimapExtent = { width: number; depth: number; minX?: number; minZ?: number }
export type MinimapView = { left: number; top: number; width: number; height: number }

export function projectSingaporeCoordinate (lon: number, lat: number, bbox: readonly number[], extent: MinimapExtent): MinimapPoint {
  const [west, south, east, north] = bbox
  return { x: Math.trunc((lon - west) / (east - west) * (extent.width - 1)), z: Math.trunc((north - lat) / (north - south) * (extent.depth - 1)) }
}

export function minimapViewport (player: MinimapPoint, pixelWidth: number, pixelHeight: number, extent: MinimapExtent): MinimapView {
  const width = Math.min(480, extent.width)
  const height = Math.min(width * pixelHeight / pixelWidth, extent.depth)
  const minX = extent.minX ?? 0; const minZ = extent.minZ ?? 0
  return { left: Math.max(minX, Math.min(minX + extent.width - width, player.x - width / 2)), top: Math.max(minZ, Math.min(minZ + extent.depth - height, player.z - height / 2)), width, height }
}

export function minimapPixel (point: MinimapPoint, view: MinimapView, pixelWidth: number, pixelHeight: number) {
  return { x: (point.x - view.left) / view.width * pixelWidth, y: (point.z - view.top) / view.height * pixelHeight }
}

/** Keep remote destinations on the map's edge, preserving their bearing. */
export function minimapPin (point: { x: number; y: number }, width: number, height: number, inset = 11) {
  const cx = width / 2; const cy = height / 2
  const dx = point.x - cx; const dy = point.y - cy
  const fraction = Math.min(1, (cx - inset) / (Math.abs(dx) || 1), (cy - inset) / (Math.abs(dy) || 1))
  return { x: cx + dx * fraction, y: cy + dy * fraction, offscreen: fraction < 1 }
}

/** Mineflayer yaw 0 points north; its positive yaw turns west. */
export function minimapHeading (yaw: number) { return -yaw }

/** Fit the entire geographic extent without stretching it; zoom keeps a world-space centre. */
export function campusMapViewport (extent: MinimapExtent, pixelWidth: number, pixelHeight: number, zoom = 1, center?: MinimapPoint): MinimapView {
  const minX = extent.minX ?? 0; const minZ = extent.minZ ?? 0
  const scale = Math.min(pixelWidth / extent.width, pixelHeight / extent.depth) * Math.max(1, Math.min(6, zoom))
  const width = pixelWidth / scale; const height = pixelHeight / scale
  const midpoint = { x: minX + extent.width / 2, z: minZ + extent.depth / 2 }
  const position = center ?? midpoint
  const x = width >= extent.width ? midpoint.x : Math.max(minX + width / 2, Math.min(minX + extent.width - width / 2, position.x))
  const z = height >= extent.depth ? midpoint.z : Math.max(minZ + height / 2, Math.min(minZ + extent.depth - height / 2, position.z))
  return { left: x - width / 2, top: z - height / 2, width, height }
}
