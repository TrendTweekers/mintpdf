# Keyword research queue

## Method: three free layers, no subscription

**1. Google autocomplete — free, unlimited, candidate discovery.** No volumes, but it is where the
candidate list comes from and it costs nothing:

```
https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=<seed>
```

**2. Bing Webmaster `GetKeywordStats` — free, real numbers, works with the existing API key** and is
NOT site-scoped, so the key for the other five properties queries anything:

```
https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats?q=<kw>&country=us&language=en-US&apikey=<key>
```

Returns monthly Impressions and BroadImpressions per date. **Its floor is high**: "markdown to pdf"
returns 167 impressions/month, but "html to pdf api" (90/mo on Google) returns an empty array, so it
cannot discriminate in the long tail, which is exactly where the interesting keywords are. Use it to
separate big from small, not to rank the small ones. `GetRelatedKeywords` returns nothing useful.

**3. Ubersuggest — 3 reports/day, ALL tools share the quota.** The important part:
**`match_keywords` returns up to 50 keywords with volume, difficulty and CPC for the SAME one report
that a single-keyword lookup costs.** Three calls a day is up to 150 measured keywords, not 3. Never
spend a report on `keyword_overview` for one keyword again unless it is a one-off check.

### Rejected alternatives (checked 2026-08-13)

- **Google Ads Keyword Planner**: without active ad spend it shows ranges ("1K-10K"), not numbers, so
  50 / 90 / 110 / 14,800 all collapse into two buckets. Also the Ads API needs a developer token that
  is test-account-only until you apply for production access. Not usable for this work.
- **Ahrefs**: the official MCP is installed in the claude.ai account and only needs an OAuth click,
  but it requires a paid subscription to return data. Peter declined.
- **DataForSEO**: real and cheap per request, worth revisiting only if this becomes an automated
  pipeline. OpenSEO MCP is a wrapper over it, so it is not free either.

## Measured so far (US)

| keyword | volume/mo | CPC | difficulty | read |
|---|---|---|---|---|
| markdown to pdf | 14,800 | $2.58 | 40 | volume, but free-converter intent |
| pdf api | 110 | $15.30 | **50** | biggest buyer term, hardest |
| html to pdf api | 90 | $9.01 | 31 | winnable |
| pdf generation api | 50 | $15.58 | 25 | winnable |
| ssrf prevention | 20 | - | 29 | credibility only, no demand |
| puppeteer ssrf | 10 | - | 18 | credibility only |
| headless browser ssrf | 0 | - | 12 | credibility only |

**Conclusion: the whole US buyer-intent market in organic search is roughly 250 searches a month.**
Winning the two winnable terms outright is maybe 60 clicks/month, three customers at a generous 5%.
Search cannot be the channel for buyers. Volume only exists on the free-converter side, which is why
the localStorage API bridge is the primary acquisition mechanism rather than a nice-to-have.

## Measured 2026-08-14, three reports, two strategies killed

**"convert a html to pdf": 14,800/mo at difficulty 11 is a DATA ARTIFACT.** The SERP shows an AI
Overview at position 1 and then pdfcrowd (DA 44, 5,068 clicks), adobe (96), sejda (64), reddit (92),
ilovepdf (65), youtube (100), cloudconvert (67), itextpdf (53), princexml (49), smallpdf. **The DA
floor is 44 and nothing weak is on the page.** The original doctrine (skip html-to-pdf) was correct.
**Rule: trust the SERP, never the difficulty score.** A huge-volume keyword at difficulty 11 is a bug
in the data, not an opportunity.

**The developer-modifier seam does not exist.** puppeteer pdf 170/mo, markdown to pdf python 110,
puppeteer pdf generation 50, pdf generation library 40, convert markdown to pdf python 30, the rest
0-30. Roughly 400-500 searches/month total, and **CPC is $0.00 on every single one**. Advertisers pay
$9-$15.58 for "pdf generation api" and nothing at all here, which is the market saying these searchers
do not buy. Hypothesis disproven; do not build pages for it.

**What survives is what we already had:** "markdown to pdf" 14,800/mo, difficulty 40, DA floor 11 on
page one, and the page is already built and correctly targeted (title, h1 and description all match,
including the "convert markdown to pdf" variant at 3,600/mo). **The bottleneck is authority and age,
not keywords or copy.** Nothing on-page left to fix. Stop researching and let the page age.

Worth studying instead: **pdfcrowd.com holds position 2 at DA 44 with ~5,068 clicks/month** running
almost exactly our business model (hosted HTML-to-PDF API with free converter pages). Better comparable
than apitemplate.io because they already hold the position we want.

## The seam that was tested and failed

Developer-modifier queries sit between the two populations: consumer-sized volume, but the searcher
is a developer with an ongoing problem rather than someone converting one file. A person searching
"markdown to pdf python" is a plausible API customer in a way that "convert to pdf online free" never
is. All harvested free from autocomplete, none measured yet.

Queue, three per day, highest expected value first:

1. `markdown to pdf python`
2. `markdown to pdf cli`
3. `html to pdf python`
4. `pdf generation library python`
5. `render pdf in react`
6. `markdown to pdf linux`
7. `markdown to pdf converter online`
8. `json to pdf python`

Skip: `pdf generation api servicenow` (platform-specific), and everything in the generic consumer
cluster (`convert to pdf`, `jpg to pdf`, `docx to pdf online free`), which is Smallpdf/Adobe/iLovePDF
turf at DA 75-96.

## Rule

Check the SERP before writing, every time. Only build where page one has independent sites rather
than vendor docs or the consumer-PDF giants. A page that cannot rank is a page that costs a day and
returns nothing.

## SE Ranking trial, 2026-08-14 — the findings that changed things

14-day trial, 100K credits, MCP at `https://api.seranking.com/mcp`. **Auth is `X-Api-Key`, not
`Authorization: Bearer`** (the Bearer path returns 401 and tells you to use OAuth). 217 tools.

**It settled the "convert a html to pdf" question independently.** Ubersuggest said 14,800/mo;
SE Ranking says **10**. Two sources now agree that number was an artifact, matching what the SERP
already showed.

**Difficulty scores are not comparable across tools and neither is authoritative.** "markdown to pdf"
is difficulty 40 on Ubersuggest and **81** on SE Ranking; "html to pdf" is 44 vs **90**. The SERP
remains the only real evidence.

**The keyword is growing, which Ubersuggest reported as flat.** 12 months of history for
"markdown to pdf": 4,400 → 3,200 → 4,900 → 6,600 → 8,100 → 9,900 → 10,800 → **12,100**. Roughly 3x
in a year.

**The cluster is far bigger than the head term.** `markdowntopdf.com` earns ~3,979 clicks/month from
it: "markdown to pdf" #1 (2,579 clicks), **"md to pdf" #2 (668 clicks, and also 12,100/mo volume)**,
"markdown pdf" (2,400/mo), "convert markdown to pdf" (720), "md to pdf converter" (590),
"md file to pdf" (480), "convert markdown" (920). Total addressable cluster is north of 31,000
searches a month, not 14,800.

**The gap this exposed:** `/markdown-to-pdf` mentioned "md to pdf" exactly **zero** times, despite it
being an equal-volume synonym. Fixed 2026-08-14 in the title, description, intro and a new FAQ entry
that also lands in the FAQPage schema.

**How the winners actually work.** pdfcrowd ranks **#1 for fifteen near-identical phrasings**
("html to pdf online", "convert html to pdf online", "change html to pdf online", "turn html into
pdf"…), each 260-320/mo and ~50 clicks, from ONE page. You do not build a page per variant. Rank the
head term and the tail follows.

**Worth using while the trial lasts:** `DATA_getDomainKeywords` on competitors, `DATA_getBacklinks*`
for their link profiles (the link-prospecting list we have never had), `DATA_getLongTailKeywords`,
`DATA_getKeywordQuestions`.
