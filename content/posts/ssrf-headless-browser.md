---
slug: ssrf-headless-browser
title: Rendering user HTML turns your server into an SSRF proxy
description: Blocking private IPs on the submitted URL covers one request out of many. The second layer that catches every subresource, the caching asymmetry that beats DNS rebinding, and six IPv6 parsing bugs, four of which were in my own code.
date: 2026-08-12
---

Every HTML to PDF service has the same shape. Someone hands you markup, you open it in headless
Chromium, you print to PDF. If you want Mermaid diagrams or KaTeX math to render, that markup has to
be allowed to run JavaScript.

Which means you have built a machine that fetches arbitrary URLs from inside your own network, on
request, for strangers.

Most write-ups stop at "block private IP addresses". That is the easy half. The hard half is that the
URL your user submits is not the only URL your service requests, and an IP address has more spellings
than you think.

## The request you validated is not the request you make

Say you accept a URL and check it before rendering:

```js
const url = new URL(input);
if (isPrivateIp(await resolve(url.hostname))) throw new Error("refused");
await page.goto(url);
```

That check covers exactly one request. The page you just loaded can issue as many more as it likes,
and none of them went through your validator:

```html
<img src="http://169.254.169.254/latest/meta-data/iam/security-credentials/">
<script>
  fetch('http://localhost:6379').then(r => r.text()).then(t => document.title = t);
</script>
```

The image fetch reaches the cloud metadata endpoint. The `fetch` hits Redis on loopback. A redirect
from a public URL to an internal one slips past too, because you validated the URL before the
redirect existed.

So you need two layers, and the second is the one that matters:

```js
await page.setRequestInterception(true);
page.on("request", async (req) => {
  if (await isAllowedRequestUrl(req.url())) await req.continue();
  else await req.abort();
});
```

Every subresource, every redirect hop, every XHR. Chromium now asks permission before each one.

## DNS rebinding, and the asymmetry that beats it

Now the classic attack. Your validator resolves `evil.example`, gets a public address, and passes it.
Chromium then resolves the same name again to make the real request, and this time the record answers
`127.0.0.1`. Two lookups, two answers, and the gap between them is the vulnerability.

You cannot fully close that gap without pinning the resolved address at the socket layer. You can
narrow it a great deal, and one design decision does most of the work:

**Cache refusals. Never cache approvals.**

```js
const blockedCache = new Map();
const BLOCKED_TTL_MS = 60_000;
```

That looks like a performance detail. It is the security property. Cache "this host is public" for
even sixty seconds and an attacker answers public once, gets the verdict cached, then points the
record wherever they like for the rest of the window. Your cache is now defeating your validator.

Caching the refusal is safe, because the cached answer is the "no". A host that turns benign later is
merely blocked a little longer than necessary, and nobody is harmed by that.

The same instinct belongs everywhere else. When you cannot tell, refuse:

```js
try {
  const addrs = await lookup(host, { all: true });
  isPrivate = addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address));
} catch {
  isPrivate = true; // a name that will not resolve is refused, not passed through
}
```

A URL that will not parse gets the same treatment: return `false`, not `true`. The schemes that
legitimately arrive here (`data:`, `about:`, `blob:`) all parse fine, so a parse failure is genuinely
suspicious.

Allowlist the schemes rather than blocklisting them, too. `ftp:`, `ws:` and `chrome-extension:` have
no business in a document you were asked to render, and you will never think of all of them in
advance.

## The part that actually bites: parsing

Here is where I lost the most time, and where I suspect most implementations are quietly wrong. Four
of the six below were real bugs in my own code, found by writing the test suite rather than by reading
it.

If you use a library for this rather than hand-rolling it, good instinct, and you still want this
list. Read each item as a test case to throw at whatever you chose, because a parser that quietly
accepts one of these spellings fails **open**, and nothing in your logs will tell you. The short
version, if you read nothing else: `::ffff:7f00:1`, `fe80::1%eth0`, `::ffff:1.2.3.4.5` and
`http://[::1]/` should all be refused. If any of them is allowed, you have the bug.

**`parseInt` is not a validator.** It takes a valid prefix and ignores the rest, so `parseInt("1g", 16)`
is `1` rather than an error. Validate the shape first and parse second:

```js
if (!/^[0-9a-f]{1,4}$/.test(hextet)) return null;
```

**Anchor the dotted quad.** IPv6 permits a trailing IPv4 form, `::ffff:127.0.0.1`. Match that suffix
without anchoring both ends and `::ffff:1.2.3.4.5`, `::ffff:1.2.3` and `::ffff:1.2.3.4x` are all
accepted, because the regex consumes the part it likes and ignores the rest.

**Reject zone indices, do not strip them.** Node treats `fe80::1%eth0` as a valid address. Stripping
the `%eth0` and carrying on is tempting. Do not: a scoped address is not something a web page should
be fetching, and stripping a suffix is how malformed input becomes valid input.

**Judge mapped addresses by what they embed.** `::ffff:127.0.0.1` and `::ffff:7f00:1` are the same
address wearing different clothes. Compare bytes, not strings, or you will block one spelling and
wave the other through.

**NAT64 is not where you expect.** The translation prefix is `64:ff9b::/96`. Its first hextet is
`0x0064`, so the significant bytes sit at offsets 1 to 3, not 0 to 2. Off by one here and you block
nothing at all.

**Teredo needs all four bytes.** The prefix is `2001:0000::/32`. I originally checked three, which was
worse than useless: it blocked `2001:0001::/32` and everything else under `2001:00xx`, which are
ordinary public addresses. An over-broad rule is still a bug. It just fails in a direction nobody
reports to you.

One more, easy to miss because it looks like it works. WHATWG `URL` keeps the brackets on an IPv6
host, so `new URL("http://[::1]/").hostname` is `"[::1]"`, and Node's `isIP()` rejects that form.
Leave the brackets on and every IPv6 literal falls through to a DNS lookup that fails and gets
refused. Correct by accident for private addresses, wrong for public ones, and it breaks the day you
change your fallback.

## What this does not do

It narrows the rebinding window. It does not eliminate it. Closing it properly means resolving the
name once and pinning that address at the socket layer so the connection cannot be redirected. That
is not implemented here, and I would rather say so than let you assume otherwise.

It also assumes the renderer is not otherwise contained. Network policy at the container level, a
blocked metadata endpoint and an egress allowlist are all better defences than anything above,
because they do not depend on my parser being correct. Treat this as the layer that catches what
those miss, not as the only thing between a stranger and your instance metadata.

## The part worth stealing

If you take one thing from this: write the tests before you trust the parser. Mine has thirty-one
cases for the URL layer and forty-five assertions for IPv6 alone, and it found four real bugs in code
I had already read twice and believed was correct. Address parsing is exactly the kind of problem
where reading proves nothing, because every one of these bugs looks perfectly reasonable on the page.

All of this runs in MintPDF and the implementation is MIT licensed, so the full version is
[on GitHub](https://github.com/TrendTweekers/mintpdf) if you want the rest of it.
