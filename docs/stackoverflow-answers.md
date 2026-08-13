# Stack Overflow answers, drafted and tested

Six open, answerable questions on Chromium PDF fragmentation. Everything marked **verified** was
reproduced by rendering it, not recalled.

## The rules, before posting

- **One a day, maximum.** Six answers in an afternoon from a new account reads as a campaign.
- **Disclose every time.** Undisclosed self-promotion gets accounts removed.
- The product mention is the last line, never the point. If the answer would not stand with that line
  deleted, it is not good enough to post.
- **Links are `nofollow`.** This is referral and reputation, not SEO. Do not expect ranking benefit.
- Skip any question where the existing accepted answer is already correct and complete.

## What the testing actually showed

Rendered on current Chromium, control cases included so the tests discriminate:

| case | result |
|---|---|
| block spanning a page boundary, no rule | **splits** (control works) |
| same block, `break-inside: avoid` | kept together |
| ditto inside `display:flex` parent | kept together |
| ditto inside `display:grid` parent | kept together |
| ditto with `float:left`, `overflow:hidden`, `position:relative` | kept together |
| `table { break-inside: avoid }` | **kept together** |
| `tr { break-inside: avoid }` only | **still splits the table** |
| table taller than one page + avoid | splits, unavoidably |
| `thead`/`tfoot` at 231px and 400px (the 2019 bug report) | **no blank first page** |

**Conclusion: three of these six questions describe Chromium bugs from 2018 to 2020 that no longer
reproduce.** Saying so, with a reproduction, is more useful than repeating the old workaround.

---

## 1. Prevent page breaks in puppeteer pdf — 7,262 views, 1 answer
https://stackoverflow.com/q/75185272

> The rule is on the wrong element. `break-inside: avoid` on `tbody` or `tr` protects individual
> rows, not the table, so the table still splits wherever a row boundary falls.
>
> Put it on the table itself, and use the modern property (`page-break-inside` is the legacy alias and
> is worth dropping):
>
> ```css
> table { break-inside: avoid; }
> ```
>
> I tested this on current Chromium with a table positioned to straddle a page boundary:
>
> - no rule → table splits across pages 1 and 2
> - `tr { break-inside: avoid }` → **still splits**
> - `table { break-inside: avoid }` → moves whole to page 2, intact
>
> One hard limit worth knowing before you chase this further: if the table is taller than a single
> page, no CSS can keep it together. Chromium honours the rule as far as starting it on a fresh page
> and then has to break it anyway. In my test a 60-row table with the rule still spanned two pages,
> because it physically cannot fit on one.
>
> If that is your case, the useful pair is instead:
>
> ```css
> tr { break-inside: avoid; }            /* never cut a row in half */
> thead { display: table-header-group; } /* repeat the header on every page */
> ```
>
> so the table breaks, but readably.
>
> Disclosure: I build a hosted HTML/Markdown to PDF API and this print CSS is most of what it does,
> so this is a problem I have spent a lot of time on. Source: https://github.com/TrendTweekers/mintpdf

---

## 2. "break-inside: avoid" is ignored — 8,458 views, 3 answers
https://stackoverflow.com/q/63602216

> This was real in 2020 with Puppeteer 5.x, and it does not reproduce on current Chromium. Worth
> re-testing before working around it.
>
> I rendered a block straddling a page boundary in each of these contexts, with a no-rule control:
>
> - no rule → splits, as expected
> - `break-inside: avoid` → kept together
> - same, inside a `display:flex` parent → kept together
> - same, inside a `display:grid` parent → kept together
> - same, with `float:left` (as in the question), `overflow:hidden`, `position:relative` → kept together
>
> So on a current build the property is honoured, including on floated elements, which used to be the
> usual suspect.
>
> If you still see it ignored, the causes worth checking, in order:
>
> 1. **The element is taller than one page.** Nothing can fix this; the rule is dropped by necessity.
> 2. **You are looking at a table.** `break-inside` on `tr` or `tbody` protects rows, not the table.
>    The rule belongs on the `table` element.
> 3. **Media type.** If you rely on `@media print` rules, call
>    `await page.emulateMediaType('print')` before `page.pdf()`, otherwise those blocks never apply.
> 4. **Chromium version.** `puppeteer` pins its own build; `puppeteer-core` uses whatever you point it
>    at, which can be years old.
>
> Disclosure: I maintain a PDF rendering API built on this behaviour, so I had the harness to test it:
> https://github.com/TrendTweekers/mintpdf

---

## 3. puppeteer break-word when generating pdf from html — 2,496 views, 0 answers
https://stackoverflow.com/q/49923785

> Late answer, but this question still gets traffic and the situation has changed since 2018.
>
> `break-inside: avoid` on the div is now honoured by Chromium. I tested a block deliberately placed
> across a page boundary: without the rule it splits, with it the whole block moves to the next page
> intact, and that held inside flex and grid parents and with `float`, `overflow:hidden` and
> `position:relative` on the element.
>
> ```css
> .keep-together { break-inside: avoid; }
> ```
>
> Two things that will still defeat it:
>
> - **A block taller than one page.** Impossible to honour, and Chromium drops the rule rather than
>   failing.
> - **Rules scoped to `@media print`** when Puppeteer is emulating screen. Call
>   `await page.emulateMediaType('print')` first, and pass `printBackground: true` if you rely on
>   background colours.
>
> If you are on `puppeteer-core` with an old Chromium, upgrade before debugging the CSS; several
> fragmentation bugs from that era are fixed.
>
> Disclosure: I build a hosted PDF API where this CSS is the product, hence the test harness:
> https://github.com/TrendTweekers/mintpdf

---

## 4. thead/tfoot incorrect layout when printed — 2,621 views, 2 answers
https://stackoverflow.com/q/56108198

> This looks like a Chromium fragmentation bug of the era rather than anything wrong with your markup,
> and it does not reproduce on a current build.
>
> I rebuilt the repro with `thead`/`tfoot` cells at the 231px from your example, then at 400px, with
> `display: table-header-group` and `table-footer-group` as you have them. In every case the first data
> row renders on page one. No skipped page.
>
> So the first thing to try is simply a newer Chromium. If you are pinned to an old one, the practical
> workaround is to stop asking the table to carry the repeating header at all, and let Puppeteer do it:
>
> ```js
> await page.pdf({
>   displayHeaderFooter: true,
>   headerTemplate: '<div style="font-size:10px;width:100%;text-align:center">…</div>',
>   footerTemplate: '<div style="font-size:10px;width:100%;text-align:center">' +
>                   'Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
>   margin: { top: '80px', bottom: '60px' },
> });
> ```
>
> That path reserves the space properly, which the `thead` trick never really does.
>
> Disclosure: I run a PDF API built on headless Chromium, which is why I had the setup to re-test this:
> https://github.com/TrendTweekers/mintpdf

---

## 5. Elements overlapping fixed footer — 4,390 views, 1 answer
https://stackoverflow.com/q/65491125

> The problem is that `position: fixed` takes the footer out of normal flow. Chromium repeats it on
> every printed page, which is why it looks like it works, but the page content has no idea it is
> there and no space is reserved. Long content therefore runs underneath it.
>
> No CSS fixes this, because nothing is being asked to flow around the footer. Move the footer out of
> the document and into the print settings, where the margin genuinely reserves space:
>
> ```php
> Browsershot::html($html)
>     ->showBrowserHeaderAndFooter()
>     ->footerHtml('<div style="font-size:10px;width:100%;text-align:center">…</div>')
>     ->margins(10, 10, 25, 10)   // the bottom margin is what stops the overlap
>     ->save($path);
> ```
>
> Two details that catch people out with Browsershot and Puppeteer alike: the header and footer
> templates are rendered in a separate context that **ignores your page CSS entirely**, so every style
> must be inline, and their default font size is tiny, so set it explicitly.
>
> For the second half of your question, breaking the table properly:
>
> ```css
> tr { break-inside: avoid; }
> thead { display: table-header-group; }
> ```
>
> Disclosure: I build a hosted PDF API on the same engine, so this is well-trodden ground for me:
> https://github.com/TrendTweekers/mintpdf

---

## 6. Header and footer have different scale than content — 2,733 views, 1 answer
https://stackoverflow.com/q/75235852

> The header and footer are not part of your document. Chromium renders them from
> `headerTemplate`/`footerTemplate` into a separate context, which means two things that together
> explain what you are seeing.
>
> **They ignore your page CSS.** Nothing from your nunjucks template's stylesheet reaches them, and
> there is no inherited font size. Every rule has to be inline on the elements inside the template.
>
> **They do not follow the `scale` option.** If you pass `scale` to `page.pdf()`, the page content is
> scaled and the header and footer are not, so a 12px header stops matching 12px body text. That is
> the usual cause of "the header is bigger than the content".
>
> ```js
> await page.pdf({
>   scale: 0.8,
>   displayHeaderFooter: true,
>   // 12px * 0.8 = 9.6px, to match body text rendered at scale 0.8
>   headerTemplate: '<div style="font-size:9.6px;font-family:Arial;width:100%;' +
>                   'padding:0 12mm;box-sizing:border-box">…</div>',
>   margin: { top: '25mm', bottom: '20mm' },
> });
> ```
>
> Also worth knowing: the templates get no page margin of their own, so they run edge to edge unless
> you add horizontal padding, and anything taller than `margin.top` is silently clipped.
>
> Disclosure: I run a hosted PDF API built on Puppeteer, where handling exactly this is part of the
> product: https://github.com/TrendTweekers/mintpdf
