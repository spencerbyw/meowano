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
// A single note/chord gets a narrow staff so it can be drawn bigger; rows of
// chords (settings previews) get the wide one.
const WIDE = 260
const NARROW = 180
const HEIGHT = 140
const STAVE_Y = 10 // top line at y=50, bottom at y=90
// Visible band: two ledger lines above and below (D6 / G3 in treble) plus a little air.
const VIEW_TOP = 14
const VIEW_HEIGHT = 112

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
  const width = groups.length > 1 ? WIDE : NARROW
  // Everything the drawing depends on, as a string, so callers can pass fresh arrays
  // without forcing redraws. The effect rebuilds its inputs from it.
  const signature = [
    clef,
    keySignature.fifths,
    groups.map((g) => g.map(pitchName).join(',')).join(';'),
    width,
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
    const [clefPart, fifthsPart, notesPart, widthPart] = signature.split('|')
    const width = Number(widthPart)
    const clef = clefPart as Clef
    const keySignature = majorKey(Number(fifthsPart))
    const groups = notesPart
      ? notesPart.split(';').map((g) => g.split(',').map(parsePitch))
      : []
    el.replaceChildren()

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(width, HEIGHT)
    const ctx = renderer.getContext()
    const ink = { fillStyle: 'currentColor', strokeStyle: 'currentColor' }
    // Ledger lines match the staff lines (coloured in Staff.module.css), a touch
    // lighter than the notes.
    const ledger = { strokeStyle: 'var(--color-staff-line)', lineWidth: 1.6 }
    ctx.setFillStyle(ink.fillStyle)
    ctx.setStrokeStyle(ink.strokeStyle)

    const stave = new Stave(4, STAVE_Y, width - 8)
    stave.addClef(clef).addKeySignature(keySignature.name)
    stave.setEndBarType(BarlineType.END)
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
        note.setLedgerLineStyle(ledger)
        return note
      })
      const voice = new Voice({ numBeats: groups.length, beatValue: 1 }).addTickables(
        staveNotes,
      )
      new Formatter()
        .joinVoices([voice])
        .format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 16)
      voice.draw(ctx, stave)
    }

    // VexFlow draws 1px staff lines on half-pixel rows (y + 0.5) so they look crisp
    // at 1:1, but places noteheads, clefs and key signatures on whole rows. Scaled
    // up, that leaves every glyph visibly a hair above its line, so move the staff
    // and bar lines up half a unit to meet them (ledger lines are already on whole rows).
    el.querySelectorAll('.vf-stave, .vf-stavebarline').forEach((g) =>
      g.setAttribute('transform', 'translate(0 -0.5)'),
    )

    const svg = el.querySelector('svg')
    if (svg) {
      svg.setAttribute('viewBox', `0 ${VIEW_TOP} ${width} ${VIEW_HEIGHT}`)
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
      style={{ aspectRatio: `${width} / ${VIEW_HEIGHT}` }}
      role="img"
      aria-label={label}
    >
      <div ref={ref} className={styles.canvas} />
    </div>
  )
}
