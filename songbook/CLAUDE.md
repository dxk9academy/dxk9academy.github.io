# Church Songbook

A chord chart reader for a worship team. One self-contained HTML file, no
dependencies, no build step, no backend. Served as a static page on GitHub Pages.

## The problem it solves

The team used to share chord charts as PDFs over WhatsApp. Two consequences:
arrangement changes lived only in people's heads (nothing written down), and
every edit meant re-sending the file, so nobody was sure which version they had.
Songs were also very long on screen because every repeat was written out in full,
so musicians scrolled constantly while playing.

## Design constraints — please respect these

- **Single file.** `index.html` contains everything: markup, CSS, the chord
  engine, and all the song data. Do not split it into modules, add a bundler,
  or introduce a framework. It must keep working offline from a phone home
  screen and still open in a browser years from now.
- **No CDN, no npm packages, no external fonts.** The chord parser and
  transposer are hand-written (~120 lines) precisely to avoid dependencies.
  System font stack only.
- **No localStorage or backend.** Edits are session-only by design; publishing
  happens by downloading the rebuilt file and uploading it to GitHub. This keeps
  exactly one master copy.
- **Mobile first.** Musicians read this on phones in low light with their hands
  busy. Test everything at phone width.

## Architecture

Everything lives in `index.html`:

| Part | What it does |
|---|---|
| `SHARP`/`FLAT`/`transposeChord` | Chord maths. Handles slash chords and picks sharps or flats based on the song's key. |
| `parseSong(src)` | Turns a song's text into `{meta, sections[]}`. Accepts `{directives}`, plain section names on their own line (`Chorus`), and `[Chorus]` headers. |
| `toPairs(text)` | Splits `[C]lyric` into chord/lyric pairs for rendering. |
| `serialize(song)` | The inverse of `parseSong`. Used when writing edits back. |
| `render()` | Draws the current song. Sets `data-s`/`data-l`/`data-p` on each pair so edits can find their source position. |
| `shortOf(label)` | Maps a section label to its map token (`Verse 1` → `v1`). Must stay in sync with the `{map:}` tokens or roadmap chips won't jump. |
| `convertText(raw)` | Converts old chords-above-lyrics charts to inline format. Runs automatically on paste. |
| `buildFile()` | Clones the live DOM, swaps in the current `SONGS` array, returns a complete new `index.html` for download. |
| `SONGS[]` | The song library. Array of template strings, one per song. |

## Song format

```
{title: Never Once}
{role: Solemn}
{key: G}
{capo: 0}
{tempo: 72}
{map: Intro - V1 - V2 - Br - C - Mid - C x2 - Outro}
{cue: Comes straight off the end of the previous song}
{section: Verse 1}
[G]Standing on this mountaintop
[D]Looking just how far we've come
| G | D | Em |          <- a bare chord/bar row
```

Key points:
- Each section is written **once**. `{map:}` carries the playing order and
  repeats. This is the whole point of the format — do not expand repeats back
  into the body.
- `{capo:}` is the fret. The header shows both the shapes played and the
  sounding key.
- Chord edits are stored in the song's **written** key. If the user is
  transposed or capo'd when they fix a chord, `pkApply` converts it back first.
  Don't break this.

## Publishing

1. User edits in the app, presses **Download file** → gets `index.html`
2. Uploads it to the GitHub repo, replacing the old one
3. GitHub Pages serves it; the team's link updates

The file must stay named `index.html`.

## Who can edit

`const ALLOW_EDIT` near the top of the script.

- `true` — everyone who opens the link sees the ✎ button and the song editor
- `false` — read-only for everyone, unless they open the link with `#edit`
  on the end

This is cosmetic, not security. It hides the UI; it does not stop anyone
determined. Real control is GitHub repo access — only collaborators can
actually publish a change that others see.

## Known gaps / likely next work

- Chord placement in the converted songs was inferred from the original
  chords-above-lyrics files. Some chords sit a syllable off and need a
  musician's pass.
- The `++` / `+++` prefix in the church's original charts is undecoded. The
  number after it is the capo fret (confirmed: `Holy Forever`, G + 3 = Bb, and
  `OPEN` appears in the same slot). The plus signs themselves mean something
  else — ask the person who writes the charts.
- No offline caching yet. A service worker would make it work when the church
  wifi drops. This is the highest-value next addition.
- No print stylesheet.
- The chord picker has no slash-bass row (`D/F#` can't be built by tapping,
  only by editing text).
- `Joy` has a duplicated Verse 2 inherited from the source file — flagged with
  a `{cue:}`, still needs the real words.

## Testing

There is no test suite. Open `index.html` in a browser at phone width and check:
transpose, capo, the three view modes, roadmap chips jumping to the right
section, edit mode (scroll must still work), paste conversion, and that
**Download file** produces a file that opens and contains your changes.
