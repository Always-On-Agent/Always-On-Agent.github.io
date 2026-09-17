/** Browser Escape and pointer-lock loss may arrive in either order for one gesture. */
export function createAlwaysOnMenuInput (now: () => number = Date.now, gestureWindowMs = 350) {
  let pointerLocked = false
  let cursorReleased = false
  let suppressNextUnlock = false
  let lastGesture = -Infinity

  const claimGesture = () => {
    const time = now()
    if (time - lastGesture < gestureWindowMs) return false
    lastGesture = time
    return true
  }

  return {
    get cursorReleased () { return cursorReleased },
    /** Tab leaves the scene active while parking mouse-look and held movement. */
    noteCursorRelease () {
      cursorReleased = true
      suppressNextUnlock = true
    },
    /** False still means the caller must swallow this Escape, including held-key repeats. */
    noteKeyboardEscape (repeat = false) {
      return !repeat && claimGesture()
    },
    /** Observe acquisition even when a modal is already open. */
    notePointerLock () {
      pointerLocked = true
      cursorReleased = false
      suppressNextUnlock = false
    },
    /** Only a real locked-to-unlocked transition can request a pause. */
    notePointerUnlock () {
      if (!pointerLocked) return false
      pointerLocked = false
      const suppressed = suppressNextUnlock
      suppressNextUnlock = false
      return !suppressed && claimGesture()
    },
    /** Call before a programmatic close/unlock; suppression lasts until that unlock or a new lock. */
    suppressPause () {
      suppressNextUnlock = true
    }
  }
}

export const alwaysOnMenuInput = createAlwaysOnMenuInput()

/** Pointer lock owns Tab even if the last clicked HUD control still has focus. */
export function shouldHandleAlwaysOnTab (event: Pick<KeyboardEvent, 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'target'>, pointerLocked: boolean, modalOpen: boolean) {
  if (event.code !== 'Tab' || modalOpen || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false
  if (pointerLocked) return true
  return !(event.target as HTMLElement | null)?.closest?.('input, select, textarea, button, a, [contenteditable="true"], [role="dialog"], [role="textbox"]')
}

/** Ordinary Minecraft sessions keep their existing Escape behavior. */
export function isAlwaysOnScene (search = typeof location === 'undefined' ? '' : location.search) {
  return new URLSearchParams(search).has('scene')
}
