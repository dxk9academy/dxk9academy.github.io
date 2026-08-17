# CLAUDE.md — `dxk9academy.github.io` (LEGACY SITE)

> ⚠️ **This is not the live DxK9 website, and it is not a source of brand truth.**
> The canonical site and the whole DxK9 workspace live in
> **`github.com/dxk9academy/dxk9-ae-website`** (private) under `site/` (Astro + pnpm).
> Read that repo's `CLAUDE.md` and `docs/brand/2026-06-21-brand-foundation.md` **before**
> writing a single line of copy here.

*Last reviewed: 2026-08-17.*

---

## What this repo is

An early, hand-written static site for the business, published via **GitHub Pages**.

```
index.html          how-it-works.html   programmes.html
about.html          book.html
pack-bond/index.html    ← separate "The Pack Bond" landing page (self-contained, inline CSS)
css/style.css           ← the only shared stylesheet (~380 lines, CSS custom properties)
js/main.js              ← mobile nav toggle only
```

- **No build step, no package.json, no dependencies.** Edit the HTML/CSS directly; open the
  files in a browser to check.
- Every page repeats the nav/footer markup by hand — a change to navigation means editing
  **all five** top-level pages. `pack-bond/` is deliberately standalone (its own fonts and
  inline `<style>`, a different palette) — do not merge it into `css/style.css`.
- The `CNAME` file was **deliberately removed** (commit `4976be6`) to stop the redirect to
  `dxk9academy.com`. Do not re-add a CNAME without an explicit decision.

## Why the content here is wrong

This site predates the locked brand foundation and contradicts it on nearly every point:

| Here | Locked foundation (authority) |
|---|---|
| "DX K9 Academy" | **DxK9** — lowercase x, no space, no "Academy" |
| "Structure. Clarity. Real-Life Results." as the headline | **"Built, Not Just Trained."** (provisional primary); the old line is only a descriptor |
| "diagnoses, prescribes, delivers" | Medical vocabulary — flagged in the practice-profile audit as contradicting the "not a behaviourist" position. Remove it. |
| Serif/paw-era styling, wolf-grey `pack-bond` palette | Space Grotesk + Inter; Navy `#1A1A2E` · Gold `#C9A84C` · Off-White `#F7F7F5` · Charcoal `#2C2C2C`; gold on dark only |

Also standing: never claim **"force-free"** or **"positive"** (the method is
relationship-based, results-driven, **tool-agnostic**); write `dxk9.ae`, never `dxk9.com`;
Dexter is a **solo operator** — never "team"/"we"; never invent testimonials, case studies,
credentials, prices, or taglines.

## Working rules

- Treat this repo as **archive/reference** unless the owner explicitly asks for changes here.
  If asked, re-align the copy to the foundation rather than extending the old brand.
- Do not port copy out of here into the main site without running it through the foundation
  doc and `docs/launch/content-guide.md` in `dxk9-ae-website`.
- Commits are attributed to the owner's own `dxk9academy` GitHub account. Push to the branch
  you were assigned; otherwise `main`.
- Completely separate from any "OEC" / "okeeffeconsulting" work — never touch those.
