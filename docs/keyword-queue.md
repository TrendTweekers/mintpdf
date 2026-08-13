# Keyword research queue

Ubersuggest free tier allows **3 `keyword_overview` reports per day** and resets at midnight. Its
`google_suggestions` proxy is separately rate-limited and was returning 429.

**Google's own autocomplete is free and unlimited and does not touch that quota.** Use it to build
candidate lists, then spend the three daily reports only on finalists:

```
https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=<seed>
```

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
