import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { holdNote } from '../../audio/engine'
import { WHITES, isBlack, whiteIndex } from './notes'

const FEWEST_KEYS = 7

export interface KeyView {
  /** Pass to <Keys>: sets the keys' element. */
  attach: (el: HTMLDivElement | null) => void
  keysEl: HTMLDivElement | null
  /** How many white keys fit, and how wide each is (px). */
  visible: number
  keyW: number
  /** The leftmost white key on screen (index into WHITES). */
  first: number
  lastFirst: number
  moveTo: (first: number) => void
}

/**
 * Which keys are on screen: as many as fit at about `keyW` px each (at least an
 * octave), starting where `home` says once the width is known.
 *
 * - `homeKey`: when it changes, go back to `home`.
 * - `show`: when it changes to a note that's off screen, slide to centre it.
 */
export function useKeyView(
  keyW: number,
  home: (visible: number) => number,
  { homeKey, show }: { homeKey?: unknown; show?: number } = {},
): KeyView {
  const [keysEl, attach] = useState<HTMLDivElement | null>(null)
  const [stageW, setStageW] = useState(0)
  const visible = Math.min(
    WHITES.length,
    Math.max(FEWEST_KEYS, Math.round(stageW / keyW) || FEWEST_KEYS),
  )
  const lastFirst = WHITES.length - visible
  const clamp = (n: number) => Math.max(0, Math.min(lastFirst, n))
  const [want, setWant] = useState<number | null>(null)
  const first = clamp(want ?? home(visible))

  // Following homeKey and show, adjusted while rendering (no effect needed).
  const [seen, setSeen] = useState({ homeKey, show })
  if (seen.homeKey !== homeKey || seen.show !== show) {
    setSeen({ homeKey, show })
    if (seen.homeKey !== homeKey) setWant(null)
    else if (show !== undefined) {
      const i = whiteIndex(show)
      if (i < first || i >= first + visible - (isBlack(show) ? 1 : 0))
        setWant(clamp(i - Math.floor(visible / 2)))
    }
  }

  useLayoutEffect(() => {
    const el = keysEl
    if (!el) return
    const ro = new ResizeObserver(() => setStageW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [keysEl])

  return {
    attach,
    keysEl,
    visible,
    keyW: stageW / visible || keyW,
    first,
    lastFirst,
    moveTo: (n) => setWant(clamp(n)),
  }
}

/**
 * Fingers on keys: each pointer holds its own note. With `glide`, sliding along the
 * keys moves it from key to key (a glissando); without, a finger plays only the key
 * it lands on. `onPress` hears each key as it goes down. Returns the keys held now.
 */
export function usePlaying(
  el: HTMLDivElement | null,
  opts: {
    glide?: boolean
    /** One finger at a time: others are ignored while a key is down. */
    single?: boolean
    sound?: boolean
    onPress?: (midi: number) => void
  } = {},
) {
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set())
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })

  useEffect(() => {
    if (!el) return
    const fingers = new Map<number, { midi: number; lift: () => void }>()
    const update = () => setPressed(new Set([...fingers.values()].map((f) => f.midi)))
    const keyAt = (x: number, y: number) => {
      const key = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-midi]')
      return key && el.contains(key) ? Number(key.dataset.midi) : null
    }
    const press = (id: number, midi: number | null) => {
      const was = fingers.get(id)
      if (was?.midi === midi) return
      was?.lift()
      if (midi === null) fingers.delete(id)
      else {
        const { sound = true, onPress } = optsRef.current
        fingers.set(id, { midi, lift: sound ? holdNote(midi) : () => {} })
        onPress?.(midi)
      }
      update()
    }
    const lift = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return
      press(e.pointerId, null)
    }
    const liftAll = () => {
      fingers.forEach((f) => f.lift())
      fingers.clear()
      update()
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      if (optsRef.current.single && fingers.size > 0) return
      // Keep hearing this pointer even if it slides off the keys.
      el.setPointerCapture(e.pointerId)
      press(e.pointerId, keyAt(e.clientX, e.clientY))
    }
    const move = (e: PointerEvent) => {
      if (!el.hasPointerCapture(e.pointerId) || optsRef.current.glide === false) return
      press(e.pointerId, keyAt(e.clientX, e.clientY))
    }
    const onHide = () => document.hidden && liftAll()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', lift)
    el.addEventListener('pointercancel', lift)
    el.addEventListener('lostpointercapture', lift)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', lift)
      el.removeEventListener('pointercancel', lift)
      el.removeEventListener('lostpointercapture', lift)
      document.removeEventListener('visibilitychange', onHide)
      liftAll()
    }
  }, [el])

  return pressed
}
