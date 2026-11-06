// English strings. Add a new locale by copying this file and registering it in ./index.ts.
const en = {
  app: {
    name: 'Kiano',
    tagline: 'Purrfect pitch!',
  },
  splash: [
    'Purrfect pitch!',
    'Meow!',
    'Pawsome!',
    'Fur-tissimo!',
    'Clawsical!',
    'Mew-sic to my ears!',
    'Whisker-fast!',
    'Purr-actice makes purrfect!',
  ],
  splashPlain: [
    'Perfect pitch!',
    'Let’s play!',
    'Nice ears!',
    'Practice makes progress!',
  ],
  notes: {
    C: 'C',
    D: 'D',
    E: 'E',
    F: 'F',
    G: 'G',
    A: 'A',
    B: 'B',
  },
  accidentals: {
    '': '',
    '#': '♯',
    b: '♭',
    '##': '𝄪',
    bb: '𝄫',
  },
  intervals: {
    P1: 'Unison',
    m2: 'Minor 2nd',
    M2: 'Major 2nd',
    A2: 'Augmented 2nd',
    d3: 'Diminished 3rd',
    m3: 'Minor 3rd',
    M3: 'Major 3rd',
    d4: 'Diminished 4th',
    P4: 'Perfect 4th',
    A4: 'Augmented 4th',
    d5: 'Diminished 5th',
    P5: 'Perfect 5th',
    A5: 'Augmented 5th',
    m6: 'Minor 6th',
    M6: 'Major 6th',
    d7: 'Diminished 7th',
    m7: 'Minor 7th',
    M7: 'Major 7th',
    P8: 'Octave',
  },
  chords: {
    major: '{{root}} major',
    minor: '{{root}} minor',
    diminished: '{{root}} diminished',
    augmented: '{{root}} augmented',
    sus2: '{{root}} sus2',
    sus4: '{{root}} sus4',
  },
  clefs: {
    treble: 'Treble clef',
    bass: 'Bass clef',
  },
  staff: {
    label: '{{clef}}, key of {{key}} major: {{notes}}',
  },
  footer: {
    builtWith: 'Built with <heart /> by <link>Spencer Bywater</link>',
    support: 'Like this project?',
    heart: 'love',
  },
  preview: {
    next: 'New question',
  },
}

export default en
export type Resources = typeof en
