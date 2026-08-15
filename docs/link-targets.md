# Link prospecting, derived from a competitor who actually ranks

Built 2026-08-14 from SE Ranking backlink data. This is the first evidence-based answer to "how many
links does this actually take", replacing guesswork.

## The number that matters

| site | ref domains | dofollow | domain rank | on "markdown to pdf" |
|---|---|---|---|---|
| pdfcrowd.com | 2,571 | 1,805 | 75 | owns the html-to-pdf cluster |
| markdowntopdf.com | 606 | 435 | 49 | **#1**, ~3,979 clicks/mo |
| **md2file.com** | **48** | **22** | **11** | **page one, position 7** |
| **mintpdf.dev** | **5** | **3** | **0** | not ranking |

**md2file.com holds a page-one position on a 12,100/month keyword with 22 dofollow referring
domains.** That, not 435, is the price of admission. We have 3. The gap is roughly 20 to 45 domains,
which is months of work rather than years, and it is the first concrete target this project has had.

## What md2file's profile is actually made of

Pulling all 48 shows the profile splits in two, and the split is the lesson.

**Legitimate free product directories, worth submitting to.** These are real, they list developer
tools, and submission is free. This is also the one channel that has historically converted for us:
submissions and contributions, never asks.

| domain | rank | dofollow? |
|---|---|---|
| stackshare.io | 90 | no |
| saashub.com | 87 | yes |
| fazier.com | 86 | yes |
| sideprojectors.com | 81 | yes |
| uneed.best | 80 | yes |
| ainave.com | 78 | no |
| devhunt.org | 75 | **yes** |
| promoteproject.com | 72 | yes (72 links, likely sitewide, treat as low value) |
| microlaunch.net | 69 | yes |
| huntscreens.com | 67 | no |
| thataicollection.com | 61 | yes |
| buildornot.io | 47 | no |
| awesomeindie.com | 41 | yes |
| startuptile.com | 30 | yes |
| aitoolscorner.com | 20 | yes |

**Junk we must not copy.** Roughly seventeen of the forty-eight are link-shortener and spam-TLD farms:
`wants.cfd`, `takes.sbs`, `blinks.sbs`, `blinks.monster`, `quero.party`, `bye.fyi`, `atomizelink.icu`,
`byteshort.xyz`, `metamagic.top`, `blogsphere.top`, `analyticshaven.top`, `dailymusings.top`,
`takes.homes`, `urls-shortener.eu`, `z-news.link`, `domains.com.bz`, plus a Russian content
aggregator. They carry suspiciously high rank scores, which is itself the tell.

**Do not chase these.** They are the same category as the $29-$39 "premium submit" directories already
declined this week, and buying or farming them is a link scheme in Google's terms. That a competitor
has them is not permission; it is a risk they are carrying.

## Honest expectation

Working the legitimate list end to end plausibly yields ten to fourteen referring domains, roughly
half of md2file's dofollow count. Combined with the dev.to cadence already running, that is a
realistic path to the same footing as the weakest site on page one.

It is not fast. It is free, it is legitimate, and unlike everything else tried this week it has a
measured target to aim at.

## Method, to repeat for any product

```
DATA_getBacklinksSummary   target: [you, and 2-3 competitors], mode: domain
DATA_getBacklinksRefDomains target: the WEAKEST competitor that still ranks, order_by: domain_inlink_rank
```

Profile the weakest site on page one, not the strongest. The leader's 606 domains tell you nothing
achievable; the straggler's 48 tell you the actual bar. Then split the list by hand into legitimate
and junk, because the tool will not do it for you and half of it is usually junk.
