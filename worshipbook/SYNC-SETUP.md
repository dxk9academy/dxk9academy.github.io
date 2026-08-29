# Turning on the shared book

Right now the Worship Book is a static page: everyone reads the same published
file, and anything they change stays on their own phone. This turns on a shared
copy — one book, on the same link, that an admin can change from any device.

It takes about fifteen minutes and costs nothing at the sizes we need.

## What you get

- **Anyone with the link reads the current book.** No password to read.
- **Only a signed-in admin can change it.** Add, edit, delete, build services.
- **The password is never in the page.** It lives as a secret on the server,
  which is the only reason this is real security rather than decoration.
- **The last 15 versions are kept**, so a bad change can be undone.
- **It still works offline.** If the network is down the app falls back to the
  last copy on that device.

## 1. Create the Worker

1. Sign up at <https://dash.cloudflare.com> (free).
2. **Compute (Workers)** → **Create** → **Start with Hello World** → name it
   `worshipbook` → **Deploy**.
3. **Edit code**, delete what's there, paste in all of `worker.js` from this
   folder, then **Deploy**.

Note the address it gives you — something like
`https://worshipbook.<your-name>.workers.dev`.

## 2. Give it somewhere to store the book

1. **Storage & Databases → KV → Create a namespace**, name it `WORSHIPBOOK`.
2. Back in the Worker: **Settings → Bindings → Add → KV namespace**.
   - Variable name: `BOOK`  ← must be exactly this
   - Namespace: `WORSHIPBOOK`
3. **Deploy**.

## 3. Set the admin password

**Settings → Variables and Secrets → Add**

- Type: **Secret** (not plain text — a plain variable is visible in the dashboard)
- Name: `ADMIN_PASSWORD`
- Value: your password

**Deploy.**

Two things about the password:

- **Pick a new one.** Anything short, or already written down in a chat, should
  not be the key to the book. A short phrase you can type on a phone in a dark
  room is ideal — three unrelated words beats one clever one.
- **Never put it in `index.html`.** That file is public; anyone can read its
  source. The only safe place is this secret.

Optionally add `ALLOWED_ORIGIN` = `https://dxk9academy.github.io` as a plain
variable, so only the real site may talk to the Worker.

## This church's setup — already done

- Cloudflare account: the church Gmail
- Worker: `worshipbook` → **https://worshipbook.jlwwc06.workers.dev**
- KV namespace `WORSHIPBOOK`, bound to the Worker as `BOOK`
- Secret `ADMIN_PASSWORD` set on the Worker
- `SYNC_URL` in `index.html` points at the Worker

Health check any time: open <https://worshipbook.jlwwc06.workers.dev/book>.
`{"empty":true}` means it is running with nothing saved yet; a book full of
songs means all is well.

Steps 1-4 below are the record of how it was built, and what a rebuild would
take. You do not need to repeat them.

## 4. Point the app at it

In `worshipbook/index.html`, find near the top of the script:

```js
const SYNC_URL = "";
```

Put your Worker address in:

```js
const SYNC_URL = "https://worshipbook.your-name.workers.dev";
```

Commit and push. The link now shows the shared book.

## 5. Load the songs in, once

The server starts empty, and while it is empty everyone sees the published file
as before. To seed it:

1. Open the link, press **☰** → **Sign in as admin**.
2. Make any small change — a chord, a service. That first save uploads the whole
   book.
3. Check on another device: it should now show your change.

## Day to day

- **You**: open the link, sign in once, edit. Everyone has it within seconds.
  No GitHub, no downloading, no re-sending files.
- **The team**: open the link and read. Nothing to install or sign into.
- Signing in lasts 30 days per device, then asks again.
- **Download file** still works and still produces a complete standalone
  `index.html` — a good backup, and a way out if you ever want to stop using
  the Worker.

## Handing it over

Everything the next person needs is: the Cloudflare login, the admin password,
and this file. The app keeps working untouched as long as the Worker exists.

## What is deliberately not built

**A separate members' login.** Reading needs no password today, and adding one
would be a gate anyone could walk around — the content is served publicly either
way. It would add friction without adding safety. If you want reading restricted
too, that is a different and bigger job: real accounts, and the Worker checking
every read.

## If something goes wrong

| What you see | What it means |
|---|---|
| "Cannot reach the shared book" | Network down, or `SYNC_URL` is wrong. The app falls back to the copy on that device. |
| "ADMIN_PASSWORD secret is not set" | Step 3 was missed, or not deployed. |
| Sign-in always fails | The secret has a stray space, or the Worker wasn't redeployed after adding it. |
| "Refusing to save an empty book" | A safety net. The server will not accept a wipe of a book that has songs in it. |
| Need to undo a bad change | The last 15 versions are kept. Ask me to restore one — it's a single call to `/restore`. |
