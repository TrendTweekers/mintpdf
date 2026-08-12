---
title: "If you render user HTML, you have an SSRF problem. Here is the code that fixes it."
published: false
tags: security, node, webdev, javascript
canonical_url: https://mintpdf.dev/guides/ssrf-headless-browser
---

Every HTML-to-PDF service has the same shape. Someone hands you markup, you open it in headless Chromium, you print to PDF. If you want Mermaid diagrams or KaTeX math to work, that markup has to be allowed to run JavaScript.

Which means you have built a machine that fetches arbitrary URLs from inside your network, on request, for strangers.

Most write-ups stop at "block private IPs". That is the easy half. The hard half is that the URL your user submits is not the only URL your service requests, and an IP address has more spellings than you think.

## The request you validated is not the request you make

Say you accept a URL and check it before rendering:

```js
const url = new URL(input);
if (isPrivateIp(await resolve(url.hostname))) throw new Error("nope");
await page.goto(url);
```

That check covers exactly one request. The page you just loaded can issue as many more as it likes, and none of them went through your validator:

```html
<img src="http://169.254.169.254/latest/meta-data/iam/security-credentials/">
<script>fetch('http://localhost:6379').then(r => r.text()).then(t => 
  document.title = t)</script>
```

The image fetch reaches your cloud metadata endpoint. The `fetch` hits Redis on the loopback address. A redirect from a public URL to an internal one bypasses the check too, because you validated the URL before the redirect existed.

So you need two layers, and the second one is the one that matters:

```js
await page.setRequestInterception(true);
page.on("request", async (req) => {
  if (await isAllowedRequestUrl(req.url())) await req.continue();
  else await req.abort();
});
```

Every subresource, every redirect hop, every XHR. Chromium asks permission before each one.

## DNS rebinding, and the asymmetry that beats it

Now the classic attack. Your validator resolves `evil.example` and gets a public address, so it passes. Chromium then resolves it again to make the actual request, and this time the record answers `127.0.0.1`. Two lookups, two answers, and the gap between them is the vulnerability.

You cannot fully close that gap without pinning the resolved address at the socket layer. You can narrow it a lot, and there is one design decision that does most of the work:

**Cache refusals. Never cache approvals.**

```js
const blockedCache = new Map();
const BLOCKED_TTL_MS = 60_000;
```

This looks like a performance detail. It is the security property. If you cache "this host is public" for even sixty seconds, an attacker answers public once, gets that verdict cached, and then points the record wherever they like for the rest of the window. Your cache is now defeating your own validator.

Caching the refusal is safe, because the cached answer is the "no". A host that becomes benign later is simply blocked slightly longer than necessary, and nobody is harmed by that.

The same instinct applies everywhere else in this code. When you cannot tell, refuse:

```js
try {
  const addrs = await lookup(host, { all: true });
  isPrivate = addrs.length === 0 || addrs.some(a => isPrivateIp(a.address));
} catch {
  isPrivate = true;   // a name that will not resolve is refused, not passed through
}
```

A URL that will not even parse gets the same treatment. It returns `false`, not `true`. The schemes that legitimately arrive here (`data:`, `about:`, `blob:`) all parse fine, so a parse failure is genuinely suspicious.

And allowlist the schemes rather than blocklisting them. `ftp:`, `ws:` and `chrome-extension:` have no business in a document you were asked to render, and you will never think of all of them in advance.

## Now the part that actually bites: parsing

Here is where I lost the most time, and where I suspect most implementations are quietly wrong. Every one of these was a real bug in my own code, found by writing the test suite rather than by reading it.

**`parseInt` is not a validator.** It takes a valid prefix and ignores the rest. `parseInt("1g", 16)` is `1`, not an error. So `::1g` parses as `::1`, or worse, as something that passes a check it should have failed. Validate the shape first, parse second:

```js
if (!/^[0-9a-f]{1,4}$/.test(hextet)) return null;
```

**Anchor your dotted quad.** IPv6 allows a trailing IPv4 form, `::ffff:127.0.0.1`. If you match that suffix without anchoring both ends, then `::ffff:1.2.3.4.5`, `::ffff:1.2.3` and `::ffff:1.2.3.4x` all get accepted, because your regex happily consumes the part it likes and ignores the rest.

**Reject zone indices, do not strip them.** Node considers `fe80::1%eth0` a valid IPv6 address. It is tempting to strip the `%eth0` and carry on. Do not. A scoped address is not something a web page should ever be fetching, and stripping a suffix is how malformed input becomes valid input.

**Judge mapped addresses by what they embed.** `::ffff:127.0.0.1` and `::ffff:7f00:1` are the same address wearing different clothes. Compare the bytes, not the string, or you will block one spelling and wave the other through.

**NAT64 is not where you think it is.** The translation prefix is `64:ff9b::/96`. The first hextet is `0x0064`, so the significant bytes sit at offsets 1 to 3, not 0 to 2. Get this off by one and you block nothing.

**Teredo needs all four bytes.** The prefix is `2001:0000::/32`. I originally checked three bytes, which was worse than useless: it blocked `2001:0001::/32` and everything else under `2001:00xx`, which are ordinary public addresses. An over-broad rule is still a bug, it just fails in a direction nobody reports.

**Strip the brackets.** WHATWG `URL` keeps them: `new URL("http://[::1]/").hostname` is `"[::1]"`, and Node's `isIP()` rejects the bracketed form. Miss this and every IPv6 literal falls through to a DNS lookup that fails, gets refused, and looks like it works. It is correct by accident for private addresses, wrong for public ones, and it will break the day you change your fallback.

## What this does not do

It narrows the rebinding window. It does not eliminate it. Fully closing it means resolving the name once and pinning that address at the socket layer so the request cannot be redirected to a different one. That is not implemented here, and I would rather say so than let you assume otherwise.

It also assumes your renderer is not otherwise sandboxed. Network policy at the container level, a blocked metadata endpoint, and an egress allowlist are all better defences than anything above, because they do not depend on my parser being correct. Treat this as the layer that catches what those miss, not as the only thing standing between a stranger and your instance metadata.

## The part worth stealing

If you take one thing: write the test suite before you trust the parser. Mine has thirty-one cases for the URL layer and forty-five assertions for IPv6 alone, and it found four real bugs in code I had already read twice and believed was correct. Address parsing is exactly the kind of problem where reading proves nothing, because every bug looks reasonable on the page.

The code above runs in [MintPDF](https://mintpdf.dev), a Markdown and HTML to PDF API. It is MIT licensed, so the full implementation is [on GitHub](https://github.com/TrendTweekers/mintpdf) if you want the rest of it.
