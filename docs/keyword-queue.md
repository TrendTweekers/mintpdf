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

## The seam worth testing next

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
