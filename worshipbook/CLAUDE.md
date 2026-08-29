# Worship Book

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
- **No backend.** Publishing still happens by downloading the rebuilt file and
  uploading it to GitHub, which keeps exactly one master copy that everyone sees.
- **localStorage keeps work on the device it was typed on.** This was originally
  ruled out; it was reinstated because losing a whole set list on an accidental
  reload was worse than the duplication it guards against. It is a scratchpad,
  not sync — see below.
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
| `mapSteps(song)` | The arrangement as a list of **performance steps**. |
| `goStep(i)` / `paintSteps()` | Move to, and highlight, one step. |
| `markLine()` | Highlights the line under the reading position while auto-scrolling. |
| `convertText(raw)` | Converts old chords-above-lyrics charts to inline format. Runs automatically on paste. |
| `buildFile()` | Clones the live DOM, swaps in the current `SONGS` array, returns a complete new `index.html` for download. Song text is escaped on the way back into the backticks — without that, backslashes are eaten on every publish. |
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

## Home

`showHome` / `renderHome`, a full-screen view over the reader, and where the app
opens. It answers the two questions a musician has in the first two seconds:
**which service is next, and what songs and keys are in it** — the pair the
established worship apps lead with, because seeing the keys early is how someone
spots a song they need to rehearse.

- The featured service is the one open, else the newest with songs in it.
- Each row is number, title, role, key, and capo when there is one. Tapping a
  row opens that song *and* makes its service active, so next/previous then walk
  the set.
- **Start the set** opens song one.
- A resume tile appears for the last song opened (`worshipbook.v1.last`).
- The footer line states the true sync state, so nobody assumes their edits are
  shared when they are not.

`body[data-home="1"]` hides the reader, the sticky header and the play bar.
`openSong` leaves home; the `◂` button in the top bar returns to it.

The app used to open on whichever song happened to be first, with no context.
Don't go back to that.

## Performance position — the important idea

A section is written once, but `{map:}` may play it several times. `V1 - C - V2 -
C - Br - C x2` has one Chorus in the body and **three chorus positions in the
service**. So the app tracks `state.step`, an index into the map, separate from
the section it points at.

- Exactly one chip is ever lit: the one for `state.step`.
- Prev/Next move by step, so the third chorus is a different place from the first.
- Scrolling cannot tell which chorus you are on, so it only moves the step when
  the section under the reading line stops matching the current step, and then
  takes the **nearest step forward** that does match. Prev/Next is how a musician
  corrects it.

Anything that navigates must work on step indexes, never on section names.
Matching by name is what made every chorus chip light up at once.

## Services (set lists)

`SETS` is a one-line array of `{name, songs:[title]}` — a named, ordered list of
songs for one service, e.g. `Sunday 7 Sept`. The library holds exactly one copy
of each song's words; a song may sit in any number of services. References are
by **title**, so renaming a song in the editor detaches it from its services.

`buildFile()` rewrites the `let SETS=` line wholesale with `JSON.stringify`, and
matches to end of line rather than to the first `;`, because a service name may
legitimately contain one.

With a service open, the set list shows only its songs in its order, and
next/previous song walks the service instead of the library.

## Play — karaoke, not a conveyor belt

`setPlaying` / `tick` walk `state.pos` through **`PLAY`** — the arrangement
flattened into a running order, one entry per line per pass — on a
`requestAnimationFrame` clock. The highlight lands ON the line at the moment it
is sung; it is not a side effect of scroll position.

**`PLAY` is the whole point.** The page shows each section once; `{map:}` says
what is actually sung and how often, so `buildPlay` expands it: `V1 - C - Br x3
- C` becomes v1, c, br, br, br, c. Play used to walk `#song .line` in document
order, which sang every section exactly once in the order they happened to be
written — repeats and arrangement order were ignored entirely. Never go back to
document order. A song with no `{map:}` falls back to it, and only then.

`paintActive` is keyed on `state.pos`, not on the element: a one-line section
played three times lands on the same element three times and must still restart
its timing and word fill each pass.

- **Dwell** is `{tempo:}` if the song has one (one 4/4 bar per line), otherwise
  the `dwell` setting, scaled 0.55–1.8x by line length so a two-word line does
  not sit as long as a full one. The bottom-right button cycles it and shows
  the real figure in seconds, which means more to a musician than "1.4x".
- **The page settles.** `keepInBand` scrolls only when the sung line leaves the
  18%–62% band, then puts it back at 30%. A page that moves under every line is
  harder to read than one that holds still.
- **Word by word.** `prepWords` splits the active line into `.wd` spans once,
  and `markWords` fills them across the line as its dwell elapses — the sung
  part is bright, the rest stays readable. Only the active line is split, and
  never in edit mode, which does its own splitting into tappable `.w` spans.
  `buildFile` clears `#song`, so none of this reaches the exported file.
- **Play starts at the song's first line**, and scrolls there. It used to start
  at whatever sat under the header, which meant scrolling to read ahead quietly
  moved the starting point. To begin elsewhere, tap that line first.
- **Jumping moves the singing.** `goStep` sets `state.line` to the first line of
  that step's section, not just the scroll position. Scrolling alone left the
  sung line where it was and `keepInBand` dragged the page straight back.
- **Tap any line** to make it the current one. That is the fastest way back in
  sync when the leader repeats a chorus.
- A drag pauses; a tap does not. `jumping` guards the handlers so the app's own
  smooth scrolling is not mistaken for the user taking over.

Every `.line` carries the highlight's padding so becoming active never changes
layout — otherwise each step nudged the rest of the song down by 4px.

An earlier version scrolled at a constant rate and highlighted whatever sat
under a fixed y. Do not go back to that: it never lands on the sung line.

## Keeping work (localStorage)

`saveLocal` writes `{stamp, songs, sets}` under `worshipbook.v1` after every
change to the book. `loadLocal` restores it before the first `render`.

The `stamp` is a hash of the **published** `SONGS` baked into the file. When it
no longer matches, the owner has republished: the published version wins, the
older local data is moved to `worshipbook.v1.superseded`, and the user is told.
The master copy has to win, or a device that edited once would never see an
update again.

This is per-device only. Nothing here reaches another person or another phone —
the drawer footer says so, and offers **Discard my changes**. Real sharing needs
a backend; GitHub Pages serves static files and cannot accept writes.

## Publishing

1. User edits in the app, presses **Download file** → gets `index.html`
2. Uploads it to the GitHub repo, replacing the old one
3. GitHub Pages serves it; the team's link updates

The file must stay named `index.html`.

## Shared copy and admin sign-in (optional)

`SYNC_URL` near the top of the script. Empty (the default) and nothing changes:
published file plus per-device localStorage. Set to a Cloudflare Worker address
and the book becomes shared — everyone on the link reads one copy, and only a
signed-in admin can write. `worker.js` is that server; `SYNC-SETUP.md` is how to
stand it up.

**The admin password is never in this repo.** It is a Cloudflare secret, because
`index.html` is public and anyone can read its source. A password checked in the
browser is decoration, not security — the Worker does the checking, and refuses
any write without a valid token. The token is an expiry signed with HMAC using
the password as the key, so it cannot be forged and lapses on its own.

Guard rails in the Worker: a write with no token, a forged token or an expired
token is refused; it will not accept an empty book over a full one; the last 15
versions are kept for `/restore`.

Reads are public by design. A members' password would gate a page whose content
is served publicly anyway — friction without safety. Restricting reads too means
real accounts and checking every read.

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
- Chord placement in some converted songs still needs a musician's pass.
- No print stylesheet.
- No offline caching yet (deliberately parked).
- `Joy` has a duplicated Verse 2 inherited from the source file — flagged with
  a `{cue:}`, still needs the real words.
- Reads are public even with sync on; only writing is gated.
- One admin password, not per-person accounts, so an edit cannot be traced to a
  person. Fine for one leader; wrong once several people edit.

## Testing

There is no test suite. Open `index.html` in a browser at phone width and check:
transpose, capo, the three view modes, roadmap chips jumping to the right
section, edit mode (scroll must still work), paste conversion, and that
**Download file** produces a file that opens and contains your changes.

Two things worth re-checking after any change, because both broke silently once:
typing a space in the song editor (the keyboard shortcuts must not steal it),
and downloading twice in a row (song text must come back byte-identical).

The chord picker's rows are built **once**, in `buildPickerRows`. Rebuilding
them on every tap detached the button that had just been tapped, so the
outside-click handler could no longer tell the click came from inside the sheet
and closed the picker before Apply could be reached. Never rebuild a control
inside its own click handler; repaint its state instead.

Also check, on a repeated-section song such as `How Great Is Our God`: exactly
one roadmap chip is lit at any time, Prev/Next actually scrolls, and the last
section can still be reached by scrolling.

Assert on what the user can SEE, not on what a function returns. Two bugs here
passed their tests because the test clicked a button programmatically while it
was off-screen: the picker had already slid away, and tapping a chord did
nothing because edit mode was not armed.
