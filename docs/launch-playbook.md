# Launch playbook for a developer tool with an MCP server

Everything below was measured on MintPDF between 9 and 14 August 2026, not assumed. Written to be
reused on Seomely or any similar product. Numbers are real; where something was not measured it says
so.

The single most important finding: **almost none of the "distribution" channels pass SEO authority.**
They are discovery, and should be judged as discovery. Check the `rel` attribute yourself before
believing anyone, including me.

---

## Tier 1: actually worth the time

### dev.to — the only confirmed dofollow channel
One article, about an hour. Measured on the published post: **two dofollow links** to the site (no
`rel` at all on one, `noopener noreferrer` on the other, neither is `nofollow`), from a DR ~90 domain.

The detail that matters: set `canonical_url` in the frontmatter to your own copy of the article.
dev.to honours it, so Google credits your page as the original instead of letting dev.to outrank you
for your own writing. Publish the guide on your own site first, then syndicate.

Expect the link, not traffic. In four days it sent one visitor. That is fine; the link is the asset.

Cadence: one post per 10-14 days across the whole portfolio on one account, not per product.

### The official MCP registry
`registry.modelcontextprotocol.io`, namespace `io.github.<org>/<name>`, tied to your GitHub repo.
Publish from CI with GitHub OIDC rather than the interactive `mcp-publisher login github`, which
treats GitHub's `slow_down` poll response as fatal and fails repeatedly for no reason. Working
workflow is in `.github/workflows/mcp-registry.yml` in this repo. Add a version-drift guard so
`server.json` and `npm/package.json` cannot disagree.

### npm package with a one-line install
Every MCP directory wants `npx -y <package>` to work with no clone, no build, no API key. Ship a thin
stdio wrapper. Publishing gotchas: 2FA browser flow does not work under an agent harness (npm masks
the URL), so use a granular token with **Bypass 2FA** ticked, scoped to the package name. And run npm
from your Linux home, never from a `/mnt/c` path, or it reads the Windows `.npmrc` as project config
and fails on `prefix`.

### IndexNow
Free, instant, no Webmaster verification needed, and it covers Bing, Yandex, Seznam and Naver in one
POST. Host `<key>.txt` at the root returning the key as plain text, then POST the URL list. Build it
as an endpoint in the app so publishing an article triggers it. **Verify your 404 actually 404s**:
sites with a catch-all route return 200 for any path, which makes the verification meaningless while
appearing to pass.

### A free tool page, not a blog
The strongest SEO finding of the week. For "markdown to pdf" (14,800/mo US) every single winner on
page one is a **working tool**, not an article, and a DA 11 site holds a page-one position. The
competitor at position 2 (apitemplate.io, DA 28) runs 22 free tool pages on one engine. pdfcrowd holds
position 2 on "convert a html to pdf" at DA 44 with ~5,068 clicks/month on the same model.

For Seomely the equivalent is obvious: free single-purpose checkers, each targeting its own keyword,
cross-linked, all feeding the same API.

---

## Tier 2: do it, but expect referral only

Measured: **not one of these passes a followed link.**

| channel | what we measured |
|---|---|
| Glama | **zero anchors** to the site; every mention sits inside a code block. Anything derived from a README is `ugc nofollow`. |
| Smithery | mentions the domain once, not inside an anchor |
| mcpservers.org | link is explicitly `rel="nofollow"`; their $39 "Premium Submit" sells the followed version |
| GitHub (repo, awesome-lists) | every external link is `nofollow`, including your own homepage button |
| Postman | collection page is client-rendered and shows Googlebot nothing; published docs page is `noindex,nofollow` |
| Stack Overflow | `nofollow` |

They are still worth doing, because the people browsing an MCP directory are shopping for exactly
what you built. Just never count them as backlinks.

Glama specifically: it grades you, and an **A** is achievable but the config fight is real. Use
`debian:bookworm-slim` (trixie fails *their* builder), pin a commit SHA (their cached head lags days),
and set the cmd to your stdio entrypoint rather than their default `pnpm run start`, which starts an
HTTP server that mcp-proxy can never handshake with. A successful build test is not a listing: you
must then make a release, and the release form only appears further down the page with a required
version field that fails validation silently when empty.

---

## Tier 3: measured waste, or worse

**Paid directory listings.** mcp.so $39, mcpservers.org $39 premium, mcpmarket $29, Launch Llama's
$288/yr funnel. All sell the same thing: a *followed* link to your site. That is a link scheme in
Google's terms, and the fact that they charge for the follow tells you the free listing is worthless
for SEO. Declined all of them; the free queues approved us anyway, just slower.

**Stack Overflow.** Cost an evening, an IP block on both home and mobile networks, two support
tickets, and the first answer scored **−2**. Their AI policy also forbids posting model-written text,
which is the obvious use of an agent. Ceiling was 5-15 visitors/month. Worst return of the week.

**VS Code Marketplace.** Rejected four times with "Your extension has suspicious content", no clause
ever named, then a mandatory one-week cooldown. Best hypothesis: an extension that reads file contents
and POSTs them to a non-Microsoft domain looks like exfiltration from a zero-history publisher. Do not
attempt unless the extension is genuinely local-only.

**Show HN.** Worth doing once, but know the shape: 51 unique visitors on the day, still trickling
three days later, 3 points, and **every comment from the new account was auto-killed by the spam
filter** including a link-free rewrite. The submission itself was never flagged. Post the URL, leave
the text box empty, and expect the account, not the post, to be the problem.

---

## Process rules that cost real time to learn

**Check the name before you build.** MintPDF collides with an established desktop PDF editor at
mintpdf.app (Simy Dev Labs LLC). Consequence: ask any AI to research "MintPDF" and it returns
*their* product, and a marketing plan written on that basis inverted every fact about ours. Check npm,
GitHub, the relevant registry and a plain web search before registering anything.

**Trust the SERP, never the difficulty score.** "convert a html to pdf" showed 14,800/mo at difficulty
11. The actual page one has a DA floor of 44 with Adobe, Reddit, YouTube and an AI Overview. One SERP
check stopped a page that could never rank.

**CPC tells you if a keyword has buyers.** Developer long-tail ("puppeteer pdf", "markdown to pdf
python") is 400-500 searches/month at **$0.00 CPC**. The buyer terms are 50-110/month at $9-$15.58.
Zero CPC means advertisers have learned those searchers do not convert.

**Measure the funnel before optimising it.** The landing page had no way to try the product: an
animated demo and a "get a free key" email ask. 48 visitors reached it, 3 found the working converter,
0 gave an email. Putting a real working input in the hero was the single highest-value change of the
week, and it was invisible until traffic revealed it.

**Ubersuggest free tier is 3 reports/day and all tools share it**, but `match_keywords` returns up to
50 keywords with volume, difficulty and CPC for the same one report a single lookup costs. Google's
own autocomplete endpoint is free and unlimited for candidate discovery. Google Keyword Planner is
useless without active ad spend: it reports ranges like "1K-10K", not numbers.

**Analytics: use your own, and keep the visitor id un-rejoinable.** A daily-salted hash of the IP
counts uniques and identifies nobody, so no cookie banner. The consequence to plan around: you cannot
recognise a returning visitor across days. If you need a repeat-use signal, count it in
`localStorage`, which never leaves their browser and costs you nothing in privacy terms.
