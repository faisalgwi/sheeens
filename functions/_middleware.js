// Cloudflare Pages middleware: the whole site sits behind one shared access code.
// Set the code in Cloudflare: Pages project → Settings → Variables and Secrets → SITE_PASSWORD (type: Secret).
const COOKIE = "sh_auth";

async function token(secret) {
  const data = new TextEncoder().encode(`sheeens:${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function loginPage(error) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>شينز | دخول</title>
<link href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@600&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4ede0;color:#231d17;font-family:"IBM Plex Sans Arabic",system-ui,sans-serif}
@media (prefers-color-scheme:dark){body{background:#15171c;color:#efe6d6}.box{background:#20242c!important;border-color:#343944!important}input{background:#15171c!important;color:#efe6d6!important;border-color:#343944!important}}
.box{width:min(360px,90vw);background:#fbf7ef;border:1px solid #d6c9b2;border-radius:14px;padding:28px;text-align:center}
h1{font-family:"Reem Kufi",sans-serif;margin:8px 0 4px;font-size:1.8rem}
p{margin:0 0 18px;color:#6e6253}
input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #d6c9b2;border-radius:999px;font:inherit;text-align:center;font-size:1.1rem;background:#f4ede0;letter-spacing:.15em}
button{margin-top:12px;width:100%;padding:11px;border:0;border-radius:999px;background:#b4532a;color:#fff8f0;font:inherit;font-weight:600;cursor:pointer}
.err{color:#a8322b;margin-top:10px;font-size:.9rem}
</style></head><body>
<form class="box" method="POST" action="/__login">
<svg width="52" height="52" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#b4532a"/><path d="M12 38c8-1 14-5 19-12 3-4 7-7 12-7 3 0 5 1 7 3l4 1-4 2c0 7-4 14-12 17-6 2-13 1-18-1l-8 3 3-4c-1-1-2-1-3-2Z" fill="#fbf7ef"/></svg>
<h1>شينز</h1><p>دليل طيور السعودية · خاص</p>
<input type="password" name="code" placeholder="رمز الدخول" autocomplete="current-password" required autofocus>
<button type="submit">دخول</button>
${error ? `<div class="err">${error}</div>` : ""}
</form></body></html>`;
}

const html = (body, status = 200, headers = {}) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers } });

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const secret = env.SITE_PASSWORD;
  if (!secret) return html(loginPage("لم يُضبط رمز الدخول بعد في إعدادات Cloudflare (SITE_PASSWORD)."), 503);

  if (url.pathname === "/robots.txt") return next();
  const expected = await token(secret);

  if (url.pathname === "/__login" && request.method === "POST") {
    const form = await request.formData();
    const code = String(form.get("code") ?? "");
    if (code && safeEqual(await token(code), expected)) {
      return new Response("", {
        status: 303,
        headers: {
          Location: "/",
          "Set-Cookie": `${COOKIE}=${expected}; Path=/; Max-Age=${60 * 60 * 24 * 90}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return html(loginPage("الرمز غير صحيح."), 401);
  }

  if (url.pathname === "/__logout") {
    return new Response("", { status: 303, headers: { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }

  const cookies = Object.fromEntries(
    (request.headers.get("Cookie") ?? "").split(/;\s*/).filter(Boolean).map((c) => [c.split("=")[0], c.slice(c.indexOf("=") + 1)])
  );
  if (cookies[COOKIE] && safeEqual(cookies[COOKIE], expected)) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
    return out;
  }
  return html(loginPage(""), 401);
}
