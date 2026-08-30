/* =============================================================
   Worship Book — sync server (Cloudflare Worker + KV)

   Holds the one shared copy of the book. Anyone may read it; only a
   signed-in admin may write. The admin password is a Cloudflare secret,
   never in this file and never in the page, because the page is public.

   Setup is in SYNC-SETUP.md next to this file.
   ============================================================= */

const HISTORY = 15;          /* snapshots kept so a bad change can be undone */
const TOKEN_DAYS = 30;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    if (!env.ADMIN_PASSWORD) {
      return json({ error: "ADMIN_PASSWORD secret is not set on this Worker." }, cors, 500);
    }

    try {
      /* ---- read the book: open to anyone with the link ---- */
      if (url.pathname === "/book" && req.method === "GET") {
        const raw = await env.BOOK.get("book");
        return json(raw ? JSON.parse(raw) : { empty: true }, cors);
      }

      /* ---- sign in ---- */
      if (url.pathname === "/login" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const given = String(body.password || "");
        /* compare in constant time so the response cannot be timed */
        if (!(await sameSecret(given, env.ADMIN_PASSWORD))) {
          return json({ ok: false, error: "That password is not right." }, cors, 401);
        }
        return json({ ok: true, token: await mintToken(env.ADMIN_PASSWORD) }, cors);
      }

      /* ---- check a token still stands ---- */
      if (url.pathname === "/whoami" && req.method === "GET") {
        const ok = await validToken(bearer(req), env.ADMIN_PASSWORD);
        return json({ admin: ok }, cors);
      }

      /* ---- write the book: admins only ---- */
      if (url.pathname === "/book" && req.method === "POST") {
        if (!(await validToken(bearer(req), env.ADMIN_PASSWORD))) {
          return json({ ok: false, error: "Sign in as admin first." }, cors, 401);
        }
        const body = await req.json().catch(() => null);
        if (!body || !Array.isArray(body.songs)) {
          return json({ ok: false, error: "Expected { songs: [...], sets: [...] }." }, cors, 400);
        }
        const prevRaw = await env.BOOK.get("book");
        const prev = prevRaw ? JSON.parse(prevRaw) : null;

        /* Two people editing is the classic way a team loses an afternoon.
           A save carries the version it was based on; if the book has moved on
           since, refuse rather than overwrite, and hand back what is there so
           the app can offer a real choice. */
        if (prev && prev.at && body.baseAt && body.baseAt !== prev.at && !body.force) {
          return json({
            ok: false, conflict: true, serverAt: prev.at,
            songs: prev.songs, sets: prev.sets || [], settings: prev.settings || {},
            error: "Someone else saved since you loaded this."
          }, cors, 409);
        }
        if (prev && prev.songs && prev.songs.length >= 3 && body.songs.length === 0) {
          return json({ ok: false, error: "Refusing to save an empty book." }, cors, 409);
        }
        const next = { songs: body.songs, sets: body.sets || [], settings: body.settings || {}, at: Date.now() };
        if (prev) {
          const hist = JSON.parse((await env.BOOK.get("history")) || "[]");
          hist.unshift({ at: prev.at || 0, songs: prev.songs, sets: prev.sets || [], settings: prev.settings || {} });
          await env.BOOK.put("history", JSON.stringify(hist.slice(0, HISTORY)));
        }
        await env.BOOK.put("book", JSON.stringify(next));
        return json({ ok: true, at: next.at }, cors);
      }

      /* ---- list and restore earlier versions ---- */
      if (url.pathname === "/history" && req.method === "GET") {
        if (!(await validToken(bearer(req), env.ADMIN_PASSWORD))) {
          return json({ ok: false, error: "Sign in as admin first." }, cors, 401);
        }
        const hist = JSON.parse((await env.BOOK.get("history")) || "[]");
        return json({ ok: true, versions: hist.map((h, i) => ({ i, at: h.at, songs: h.songs.length })) }, cors);
      }
      if (url.pathname === "/restore" && req.method === "POST") {
        if (!(await validToken(bearer(req), env.ADMIN_PASSWORD))) {
          return json({ ok: false, error: "Sign in as admin first." }, cors, 401);
        }
        const { i } = await req.json().catch(() => ({}));
        const hist = JSON.parse((await env.BOOK.get("history")) || "[]");
        const pick = hist[i | 0];
        if (!pick) return json({ ok: false, error: "No such version." }, cors, 404);
        await env.BOOK.put("book", JSON.stringify({ songs: pick.songs, sets: pick.sets, settings: pick.settings || {}, at: Date.now() }));
        return json({ ok: true }, cors);
      }

      return json({ error: "Not found" }, cors, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, cors, 500);
    }
  },
};

/* ---------- helpers ---------- */
function json(obj, cors, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function bearer(req) {
  return (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
}
const enc = new TextEncoder();

async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
/* hash both sides before comparing, so length and content do not leak */
async function sameSecret(a, b) {
  const [ha, hb] = await Promise.all([sha(a), sha(b)]);
  if (ha.length !== hb.length) return false;
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}
async function hmac(msg, key) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}
/* the token is an expiry signed with the password — it cannot be forged
   without the password, and it stops working on its own */
async function mintToken(pw) {
  const exp = Date.now() + TOKEN_DAYS * 864e5;
  return exp + "." + (await hmac("exp:" + exp, pw));
}
async function validToken(token, pw) {
  const m = /^(\d+)\.([a-f0-9]{64})$/.exec(token || "");
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const want = await hmac("exp:" + exp, pw);
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ m[2].charCodeAt(i);
  return diff === 0;
}
