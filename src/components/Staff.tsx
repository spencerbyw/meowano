import { useEffect, useRef, useState } from 'react'
import {
  Accidental,
  BarlineType,
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
} from 'vexflow/bravura'
import type { Clef } from '../music/ranges'
import {
  displayedAccidental,
  majorKey,
  parsePitch,
  pitchName,
  type Key,
  type Pitch,
} from '../music/theory'
import styles from './Staff.module.css'

// Logical drawing size; the SVG scales to fit its container via viewBox.
const WIDTH = 260
const HEIGHT = 140
const STAVE_Y = 10 // top line at y=50, bottom at y=90: centred, with room for 2 ledger lines

// VexFlow measures glyphs with the Bravura web font, so wait for it before drawing.
const fontReady =
  typeof document !== 'undefined'
    ? document.fonts.load('30px Bravura').then(() => undefined)
    : Promise.resolve()

const vexKey = (p: Pitch) => `${p.letter.toLowerCase()}${p.acc}/${p.octave}`

interface StaffProps {
  clef: Clef
  keySignature?: Key
  /** One note or chord, centred on the staff. */
  notes?: Pitch[]
  /** Several notes/chords in a row (used by settings previews). Overrides `notes`. */
  chords?: Pitch[][]
  label: string
  className?: string
}

const C_MAJOR = majorKey(0)

export function Staff({
  clef,
  keySignature = C_MAJOR,
  notes = [],
  chords,
  label,
  className,
}: StaffProps) {
  const groups = chords ?? (notes.length ? [notes] : [])
  // Everything the drawing depends on, as a string, so callers can pass fresh arrays
  // without forcing redraws. The effect rebuilds its inputs from it.
  const signature = [
    clef,
    keySignature.fifths,
    groups.map((g) => g.map(pitchName).join(',')).join(';'),
  ].join('|')
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fontReady.then(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !ready) return
    const [clefPart, fifthsPart, notesPart] = signature.split('|')
    const clef = clefPart as Clef
    const keySignature = majorKey(Number(fifthsPart))
    const groups = notesPart
      ? notesPart.split(';').map((g) => g.split(',').map(parsePitch))
      : []
    el.replaceChildren()

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(WIDTH, HEIGHT)
    const ctx = renderer.getContext()
    const ink = { fillStyle: 'currentColor', strokeStyle: 'currentColor' }
    ctx.setFillStyle(ink.fillStyle)
    ctx.setStrokeStyle(ink.strokeStyle)

    const stave = new Stave(4, STAVE_Y, WIDTH - 8)
    stave.addClef(clef).addKeySignature(keySignature.name)
    stave.setEndBarType(BarlineType.NONE)
    stave.setStyle(ink)
    stave.setContext(ctx).draw()

    if (groups.length) {
      const staveNotes = groups.map((group) => {
        const note = new StaveNote({
          clef,
          keys: group.map(vexKey),
          duration: 'w',
          alignCenter: groups.length === 1,
        })
        group.forEach((p, i) => {
          const acc = displayedAccidental(p, keySignature)
          if (acc) note.addModifier(new Accidental(acc), i)
        })
        note.setStyle(ink)
        note.setLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 1.6 })
        return note
      })
      const voice = new Voice({ numBeats: 4 * groups.length, beatValue: 4 }).addTickables(
        staveNotes,
      )
      new Formatter()
        .joinVoices([voice])
        .format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 16)
      voice.draw(ctx, stave)
    }

    const svg = el.querySelector('svg')
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      svg.removeAttribute('width')
      svg.removeAttribute('height')
      svg.removeAttribute('style')
      el.removeAttribute('style') // VexFlow sets a fixed width on the container too
      svg.setAttribute('aria-hidden', 'true')
    }
  }, [ready, signature])

  return (
    <div
      className={[styles.staff, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
    >
      <div ref={ref} className={styles.canvas} />
    </div>
  )
}
