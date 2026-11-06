import { useEffect, useRef, useState } from 'react'
import { Accidental, Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow/bravura'
import type { Clef } from '../music/ranges'
import { displayedAccidental, type Key, type Pitch } from '../music/theory'
import styles from './Staff.module.css'

// Logical drawing size; the SVG scales to fit its container via viewBox.
const WIDTH = 260
const HEIGHT = 150
const STAVE_Y = 12 // staff's top line lands at STAVE_Y + 40

// VexFlow measures glyphs with the Bravura web font, so wait for it before drawing.
const fontReady =
  typeof document !== 'undefined'
    ? document.fonts.load('30px Bravura').then(() => undefined)
    : Promise.resolve()

const vexKey = (p: Pitch) => `${p.letter.toLowerCase()}${p.acc}/${p.octave}`

interface StaffProps {
  clef: Clef
  keySignature: Key
  notes: Pitch[]
  label: string
  className?: string
}

export function Staff({ clef, keySignature, notes, label, className }: StaffProps) {
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
    el.replaceChildren()

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(WIDTH, HEIGHT)
    const ctx = renderer.getContext()
    const ink = { fillStyle: 'currentColor', strokeStyle: 'currentColor' }
    ctx.setFillStyle(ink.fillStyle)
    ctx.setStrokeStyle(ink.strokeStyle)

    const stave = new Stave(4, STAVE_Y, WIDTH - 8)
    stave.addClef(clef).addKeySignature(keySignature.name)
    stave.setStyle(ink)
    stave.setContext(ctx).draw()

    if (notes.length) {
      const note = new StaveNote({
        clef,
        keys: notes.map(vexKey),
        duration: 'w',
        alignCenter: true,
      })
      notes.forEach((p, i) => {
        const acc = displayedAccidental(p, keySignature)
        if (acc) note.addModifier(new Accidental(acc), i)
      })
      note.setStyle(ink)
      note.setLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 1.6 })
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note])
      new Formatter()
        .joinVoices([voice])
        .format([voice], stave.getNoteEndX() - stave.getNoteStartX())
      voice.draw(ctx, stave)
    }

    const svg = el.querySelector('svg')
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      svg.removeAttribute('width')
      svg.removeAttribute('height')
      svg.setAttribute('aria-hidden', 'true')
    }
  }, [ready, clef, keySignature, notes])

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
