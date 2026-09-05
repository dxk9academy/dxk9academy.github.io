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

## Offline, and the screen staying on

`sw.js` — a service worker, and the second deliberate exception to the
single-file rule. Browsers will not register one from a blob or an inline
script, so offline genuinely requires its own file. Verified with the network
fully off: the page loads, all songs render, a chart opens.

- **Network first, cache as the safety net.** Always the freshest page when
  there is a connection, the last good copy when there is not. Cache-first
  would be simpler and would mean nobody ever sees an update.
- **The sync Worker is never cached.** A cached API answer would show stale
  songs as if they were current; better that the request fails and the app says
  so.
- Bump `VERSION` in `sw.js` when `index.html` changes meaningfully. That is what
  raises the update banner, and it is what replaces telling people to add `?v=2`
  to the address.

`keepAwake` takes a screen wake lock while a chart is open and drops it on the
home screen. The lock is released whenever the tab is hidden, so it is taken
again on `visibilitychange`.

`.updatebar[hidden]{display:none}` is not redundant. `[hidden]` is an attribute
selector, so a class rule setting `display` ties on specificity and wins on
source order — without that line the banner covers the header permanently.

## Copyright, licensing and consent

`terms.html` is the Terms of Service and takedown policy, linked from the set
list footer and from the first-run consent card. It is deliberately indexable
even though the book is not: a takedown policy nobody can find is no policy.

- **First-run consent.** `showConsent` blocks until the box is ticked, recorded
  per device under `worshipbook.v1.agreed`. It records that someone saw the
  terms, not who they are.
- **`SETTINGS`** holds `{ccli, church}`, saved and synced beside the songs so
  every device shows the same attribution. Entered through **Church settings**
  in the set list.
- **`paintAttrib`** writes the line under every chart: title, author, "Used by
  Permission", and the CCLI number — or a prompt to add one when it is blank.
  It only prints what the song actually carries; inventing a publisher would be
  worse than omitting it.
- **`{author:}`** is part of the song format and has a field in the editor.

`const agreedKey=()=>STORE+".agreed"` is a function on purpose. That block sits
above where `STORE` is declared, and reading it eagerly hit the temporal dead
zone and killed the whole script.

### The part code cannot fix

The repository still ships 13 real songs inside `index.html`, and git history
holds them across 15 commits. Removing them from the working file does not
remove them from history. Whether the "empty container" position holds is a
question for the church and, if it matters, a lawyer — not something this file
can settle.

## Copyright

The book holds copyrighted lyrics and chord charts on a publicly reachable URL.
`robots.txt` and a `noindex` tag keep it out of search results. **That reduces
exposure; it does not resolve licensing** — anyone with the link still reads it.
CCLI's church licence generally covers congregational reproduction, while
rehearsal sharing and website posting are separate modules and sheet music is
usually excluded. Worth confirming what the church holds. Not legal advice.

## Capo

`{key:}` is the **sounding** key and the chords in the body are written at
sounding pitch. `render` derives the shapes by subtracting the capo, so a song
stored in Bb with `{capo: 3}` prints G shapes and reads "sounds in Bb · play G
shapes". That model is deliberate: it means changing the capo hands you easier
shapes for the same song, which is what a capo is for.

Nine songs were originally entered the other way round — the shapes off the
paper chart in `{key:}`, with the true sounding key mentioned only in a `{cue:}`.
The app then subtracted the capo a second time and printed chords a capo below
the chart: `Offering Song` told the guitarist `| D# | A# | Cm |` where the chart
says play `| G | D | Em |` with capo 4, and `Holy Forever` said "sounds in G"
directly above its own cue saying Bb. The band was being moved a minor third.

They were retuned by transposing each song **up** by its capo — using the app's
own `transposeChord`, `toPairs` and `serialize`, so the result matches rendering
by construction rather than by hand. Verified by asserting that every chord now
displayed at the song's own capo is identical to the chord that was stored
before, across all nine songs, and that lyrics, strum marks, section counts and
capos are byte-identical across all twenty.

`prettyKey` exists because the two jobs of `{key:}` conflict. The stored key
also decides how chords are **spelled**, so naming `Thanks And Praise` "Bb"
spelled the bass of its D chord `Gb`, which nobody writes. The sharp name is
kept for the maths and the conventional flat name is shown to people, in the
header and on the home screen.

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

## Two people editing

Every save carries `baseAt`, the version it was built on. If the book has moved
on since, the Worker returns **409** with its current copy rather than accepting
the write. Last-write-wins silently is the classic way a team loses an
afternoon.

The app never picks a winner. It says who saved, when, and how many songs each
side has, then offers:

- **take theirs** — replaces the local copy and rebases
- **replace theirs with mine** — rebases to the server version and re-sends with
  `force`, a deliberate act rather than an accident

Either way the overwritten version stays in the Worker's history, so a wrong
choice is recoverable rather than final.

`force` exists only on that path. A save that has not been refused never sets
it, so a stale device cannot quietly clobber a newer book.

## Go to — the live jump

`{map:}` is the **plan**. A leader calls "one more chorus" or "back to the
bridge" constantly, and none of that is in the plan. **Go to** sings any section
from now by splicing its lines into `PLAY` at the current position.

The written arrangement is never modified. That is the whole point: what is on
the page stays what was rehearsed, and the next service starts from the plan
again rather than from last Sunday's improvising.

Sections absent from `{map:}` are still offered, marked *extra*, so a bridge
that was cut can still be called on the day. The chip for a section that *is*
in the plan lights when jumped to.

Editing the arrangement to express a live repeat would be the obvious
implementation and is the wrong one — it makes every off-script moment a
permanent edit to the song.

## Services (set lists)

The published `SETS` ships with the current service in it, so anyone opening the
link sees it without signing in. `SUGGESTED_SETS` and `offerAdditions` cover the
other half of the problem: `pullBook` replaces `SONGS` and `SETS` wholesale with
the Worker's copy, so songs added to the file are invisible on a synced device
until an admin is asked to merge them in. The prompt is admin-only, fires once
per `BASE_STAMP`, and only ever **adds** — it never removes or overwrites.

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

- **Dwell** is, in order: `livePace` (tapped just now), `{pace:}` (tapped and
  saved), `{tempo:}` (BPM, assuming one 4/4 bar a line), then the fixed `dwell`.
  Each is scaled 0.55–1.8x by line length so a two-word line does not sit as
  long as a full one. The bottom-right button shows the figure in seconds, which
  means more to a musician than "1.4x", and opens the pace sheet.

### Pace — tapped, because the band plays to no click

BPM was the obvious answer and is not sufficient alone: BPM says how fast a beat
is, not how many beats a line lasts, so it still needs a bars-per-line guess
before it becomes a scroll speed. Tapping skips the derivation and measures the
only quantity Play consumes — **seconds per line**.

It is also closed loop, which is the real point. A free-running timer is right
for thirty seconds and wrong for the rest of the song, because a live band slows
into a last chorus and nobody tells the app. Tapping fixes it in the moment.

- `tappedPace()` takes the **median** gap of the last 8 taps, not the mean, so
  one late tap cannot drag the reading. Gaps outside 0.4–15s are discarded, and
  a gap over 6s clears the taps — that is someone starting again, not a slow line.
- **`lengthFactor` is divided by `fudgeNorm`**, the song's own average factor.
  Without that the measurement gets re-multiplied by the very guess it replaced:
  the factor sits above 1 more often than below it, so `Impossible Possible` ran
  **59% slower** than the pace tapped into it. With it, tapping 1.60s gives a
  mean line of exactly 1.60s on every song while the spread still varies.
  `computeFudgeNorm()` runs in `render`, after the lines are on the page.
- **The button says "Pace", not just the number.** It first showed only "3.4s",
  which reads as a status display next to "Jump", a verb — the leader it was
  built for never found it. A control nobody sees is a control that does not
  exist.
- **The panel is not a full-screen sheet.** You tap along *while reading the
  words*, so it sits on top of the play bar and leaves the song visible; a sheet
  covering the lyrics makes the one thing you are timing impossible to watch.
  On screens under 680px tall it drops its hint text and shrinks the pad, because
  there the words matter more than the instructions.
- **Slower / Faster nudge whatever is in force, both ways.** They first walked a
  fixed ladder of seven values anchored on `dwell`, ignoring any tapped or saved
  pace — so after tapping 1.7s, pressing *Faster* jumped to 3.0s, which is
  slower, and the ladder stopped at 2.0s so a quick song could not be nudged
  faster at all. It only ever appeared to move one way. Now each press scales
  the pace actually in force by 1.08, clamped to 0.5–12s: a measured pace tunes
  that song, and with nothing measured it tunes the global `dwell` fallback.
  A saved `{pace:}` is not touched until **Save for everyone** is pressed.
- **Tapping is a performance control; everyone gets it.** It never leaves the
  device, and it resets when the song changes. Restricting it to admins would
  leave every other musician's scroll broken, which is the whole problem.
- **Saving a pace into the song is an edit** to the shared book, so it is admin
  only, gated on `body[data-readonly]` exactly like every other edit. A member
  who taps is told plainly that it stays on their phone.
- `{pace:}` is carried through the editor by a hidden `#fPace` input. `assemble()`
  rebuilds the directive block from form fields alone, so a directive with no
  field is silently dropped on save — which is what still happens to `{folder:}`.
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

## Drums

`{beat:}` carries the groove with the song, in the shape the drummer's own tool
uses so a pattern can be copied across by eye:

```
{beat: 4/4 16 HH=xxxxxxxxxxxxxxxx SN=OO--O-------O--- BD=ooo-----o-------}
```

Time signature, subdivisions per bar, then one row per voice. `parseBeat` also
accepts the short keys that tool emits (`H`, `S`, `K`, `T`, `C`, `T4`).

### The chart, not a loop

A drummer does not read one bar, they read a **road map**: section, how many
bars, what groove, where the fills go. That is how session and worship drum
charts are actually written — the groove is notated once and the rest is bar
counts, because nobody notates eighty bars of hi-hat.

So a groove belongs to a **section**, and the chart is `{map:}` expanded:

```
{section: Chorus}
{beat: 4/4 16 HH=xxxxxxxxxxxxxxxx SN=----O-------O--- BD=o--o--o---o-----}
{bars: 8}
```

`buildChart` walks `mapSteps` — the same arrangement that drives the lyrics,
the roadmap chips and Go to — so `Intro - V1 - PC - C - Refrain - Int - V2 - PC
- C - Refrain - Br - C - Refrain` becomes thirteen readable blocks. Setting the
Chorus groove once shows up on **every** chorus pass, because they are the same
section, not three copies.

Blocks carry the section's real name, not the map token: "Chorus" reads off a
chart at arm's length, "C" does not.

Playback walks that chart rather than looping one bar — `cur` is {block, bar,
subdivision} and `advance()` rolls each into the next, so each section plays its
own groove for its own bar count and hands over. Verified at 120bpm 4/4 where a
bar is 2.0s: a two-bar Intro crashes at 0 and 2.0, a one-bar Verse takes over at
4.0 with its own kick and snare, and the Intro resumes at 6.0. Play starts on
the block the band is already on, not always at the top.

**`loadInto` must stop reading song directives at the first `{section:}`.**
It matched `{beat:}` anywhere, so opening a song in the editor hoisted a chorus
groove onto the whole song and deleted it from the section.

### The kit follows the standard legend

`KIT` is the drum-set legend: each voice carries `p`, its diatonic position
above the bottom staff line, and `cyc`, the articulations that voice actually
has. Crash and hi-hat sit above the staff, ride on the top line, toms and snare
down the staff, and the feet — bass drum and hi-hat pedal — at the bottom with
their stems pointing **down**, which is what makes a drum chart readable at a
glance.

Characters: `-` rest, `o`/`x` hit, `O`/`X` accent, and per voice `o` open and
`h` half-open hi-hat, `c` cross stick, `g` ghost note, `b` bell of the ride.

**`o` and `h` mean open only on a hi-hat.** They were briefly drawn as open on
every voice, which put an open-cymbal circle over the bass drum and both toms.

### The stave

`paintStaff` draws real notation as inline SVG — neutral clef, five lines,
noteheads by voice, stems up for hands and down for feet, and beams across runs
of neighbouring notes inside one beat. Two honest shortcuts: **rests are not
drawn**, and a note with no neighbour in its beat gets a plain stem rather than
a flag. Both need a full rhythm engine to place correctly and neither changes
what a drummer plays.

Drums is its own full screen, like Home, because nine voices and a stave do not
fit in a strip above the play bar. `body[data-drums="1"]` hides the play bar —
and that rule **must sit after** `body[data-readonly="1"] .playbar{display:flex}`,
which otherwise re-shows the bar at equal specificity on source order. Same trap
as `.updatebar[hidden]`.

The row labels are `position:sticky` so they hold while the bar scrolls
sideways. A row of cells with no name against it is unreadable.

### Sound and timing

**Sounds are SYNTHESISED, never sampled.** A kit of wav files would be
megabytes, would break the single-file rule and would not survive offline. Two
helpers do all of it: `membrane` (a pitch-swept sine) for kick and toms,
`metal` (highpassed noise) for cymbals, and both together for the snare.

**Timing does not run on `requestAnimationFrame`, and must not.** rAF is fine
for a lyric highlight arriving 30ms late; a hi-hat 30ms late is audibly wrong,
and rAF stalls whenever the browser is busy. Notes are scheduled up to 120ms
ahead against `AudioContext.currentTime`, which is sample-accurate, on a 25ms
`setInterval`. rAF only moves the playhead to catch up with what was already
scheduled. Verified: at 80bpm on sixteenths every scheduled gap is exactly
0.1875s.

- **Playing is for everyone; editing is admin only**, on the same
  `body[data-readonly]` gate as every other edit. A drummer who is not signed in
  can still hear the groove.
- `openSong` calls `closeDrums`, so changing song never leaves a beat playing.
- `{beat:}` is carried through the editor by a hidden `#fBeat` input, and
  `buildFile` clears `#drumGrid`.
- Changing the subdivision keeps the hits that still land on a real subdivision
  and drops the rest, rather than silently moving them.

The iPhone ringer switch mutes Web Audio. That is the platform's behaviour, not
something this file can fix — if the beat is silent on a phone, check it first.

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
- ~~The capo header is inverted.~~ **Fixed** — see "Capo" below.
- No offline caching yet. A service worker would make it work when the church
  wifi drops. This is the highest-value next addition.
- **Bars per line** is the next real gain for Play. The charts already state it:
  a row like `| A | E/G# | A | B |` is literally four bars, and there are 28 such
  rows in the library going unused. That would replace the character-count proxy
  with actual structure. Tapping makes the mean right; this would make each
  individual line right.
- `assemble()` drops any directive without a form field. `{folder:}` is dropped
  today. `{pace:}` is carried by a hidden input; the general fix is to preserve
  unknown directives the way `serialize()` already does.
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
