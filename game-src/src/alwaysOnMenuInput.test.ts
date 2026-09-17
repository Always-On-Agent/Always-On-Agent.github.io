import { expect, test } from 'vitest'
import { createAlwaysOnMenuInput, isAlwaysOnScene, shouldHandleAlwaysOnTab } from './alwaysOnMenuInput'

function setup () {
  let time = 1000
  const input = createAlwaysOnMenuInput(() => time)
  return { input, advance (milliseconds: number) { time += milliseconds } }
}

test('keydown before native unlock opens exactly one panel despite duplicate listeners', () => {
  const { input, advance } = setup()
  input.notePointerLock()
  let opens = Number(input.noteKeyboardEscape())
  advance(15)
  opens += Number(input.notePointerUnlock())
  opens += Number(input.notePointerUnlock())
  expect(opens).toBe(1)
})

test('native unlock before keydown leaves the newly opened panel open', () => {
  const { input, advance } = setup()
  input.notePointerLock()
  let panelOpen = input.notePointerUnlock()
  advance(20)
  if (input.noteKeyboardEscape()) panelOpen = !panelOpen
  expect(panelOpen).toBe(true)
  expect(input.notePointerUnlock()).toBe(false)
  advance(400)
  expect(input.noteKeyboardEscape()).toBe(true)
})

test('held Escape cannot toggle again even after the gesture window', () => {
  const { input, advance } = setup()
  expect(input.noteKeyboardEscape()).toBe(true)
  advance(1000)
  expect(input.noteKeyboardEscape(true)).toBe(false)
  expect(input.noteKeyboardEscape()).toBe(true)
})

test('programmatic close cannot reopen from a delayed unlock or duplicate callback', () => {
  const { input, advance } = setup()
  input.notePointerLock()
  input.suppressPause()
  advance(2000)
  expect(input.notePointerUnlock()).toBe(false)
  advance(1000)
  expect(input.notePointerUnlock()).toBe(false)
  expect(input.noteKeyboardEscape()).toBe(true)
})

test('a new pointer lock clears programmatic suppression for the next native Escape', () => {
  const { input } = setup()
  input.suppressPause()
  input.notePointerLock()
  expect(input.notePointerUnlock()).toBe(true)
})

test('unlocked synthetic events never create another menu gesture', () => {
  const { input, advance } = setup()
  expect(input.notePointerUnlock()).toBe(false)
  input.notePointerLock()
  expect(input.notePointerUnlock()).toBe(true)
  advance(3000)
  expect(input.notePointerUnlock()).toBe(false)
})

test('arbitration is scoped to explicit scene URLs', () => {
  expect(isAlwaysOnScene('?scene=singapore&campusPrototype=ntumap')).toBe(true)
  expect(isAlwaysOnScene('?scene=eccv')).toBe(true)
  expect(isAlwaysOnScene('?scene=village')).toBe(true)
  expect(isAlwaysOnScene('?server=localhost')).toBe(false)
  expect(isAlwaysOnScene('')).toBe(false)
})

test('Tab parks cursor input without a pause and a new lock resumes it', () => {
  const { input } = setup()
  input.notePointerLock()
  input.noteCursorRelease()
  expect(input.cursorReleased).toBe(true)
  expect(input.notePointerUnlock()).toBe(false)
  expect(input.cursorReleased).toBe(true)
  input.notePointerLock()
  expect(input.cursorReleased).toBe(false)
  expect(input.notePointerUnlock()).toBe(true)
})

test('Escape can open a menu while Tab has released the cursor', () => {
  const { input } = setup()
  input.notePointerLock()
  input.noteCursorRelease()
  expect(input.notePointerUnlock()).toBe(false)
  expect(input.noteKeyboardEscape()).toBe(true)
})

test('Tab releases a locked scene even when a previously clicked HUD button retains keyboard focus', () => {
  const event = { code: 'Tab', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: { closest: () => ({ tagName: 'BUTTON' }) } as unknown as EventTarget }
  const { input } = setup()
  input.notePointerLock()
  expect(shouldHandleAlwaysOnTab(event, true, false)).toBe(true)
  input.noteCursorRelease()
  expect(input.notePointerUnlock()).toBe(false)
  expect(input.cursorReleased).toBe(true)
  expect(shouldHandleAlwaysOnTab(event, false, false)).toBe(false)
})

test('unlocked forms, open dialogs and browser Tab shortcuts retain native key handling', () => {
  const event = { code: 'Tab', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: { closest: () => ({ tagName: 'INPUT' }) } as unknown as EventTarget }
  expect(shouldHandleAlwaysOnTab(event, false, false)).toBe(false)
  expect(shouldHandleAlwaysOnTab(event, true, true)).toBe(false)
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) expect(shouldHandleAlwaysOnTab({ ...event, [modifier]: true }, true, false)).toBe(false)
  expect(shouldHandleAlwaysOnTab({ ...event, target: null }, false, false)).toBe(true)
  expect(shouldHandleAlwaysOnTab({ ...event, code: 'KeyW' }, true, false)).toBe(false)
})
