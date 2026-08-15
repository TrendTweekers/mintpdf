---
slug: pdf-github-action
title: How to generate a PDF in a GitHub Action
description: Two ways to turn Markdown into a PDF from CI, what installing Chromium on a runner really costs, and the zero-dependency composite action pattern.
date: 2026-08-10
---

You want your changelog, release notes or a generated report to come out of CI as a PDF. It sounds
like a ten-line workflow. Then you add Puppeteer, and the run fails with
`error while loading shared libraries: libnss3.so`.

Here are both ways to do it, what each actually costs, and the packaging detail that decides whether
your action is something people trust.

## Option 1: install a browser on the runner

This works, and if your documents are confidential it is the right answer, because nothing leaves the
machine.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24

- name: Install Chromium and its dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation fonts-noto-color-emoji fonts-noto-cjk \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
      libdrm2 libgbm1 libglib2.0-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 \
      libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 \
      libxrandr2 xdg-utils
    npm i puppeteer marked
    npx puppeteer browsers install chrome

- name: Render
  run: node render.mjs docs/report.md dist/report.pdf
```

with `render.mjs`:

```js
import { readFile, writeFile } from "node:fs/promises";
import { marked } from "marked";
import puppeteer from "puppeteer";

const [, , input, output] = process.argv;
const html = marked.parse(await readFile(input, "utf8"));

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent(`<!doctype html><meta charset="utf-8">${html}`, { waitUntil: "networkidle0" });
await writeFile(output, await page.pdf({ format: "A4", printBackground: true }));
await browser.close();
```

That list of libraries is not padding. Every one of them is a real dependency of headless Chromium on
a slim Debian base, and the failure mode when you miss one is a dynamic linker error rather than
anything that mentions PDFs. The two `apt-get` lines and the ~170MB Chrome download run on every
build unless you set up caching, which is a third thing to maintain.

There is also a defect waiting for you in the output. Chromium's default page fragmentation will slice
code blocks and tables across page boundaries, so you need a print stylesheet as well. That is a
separate problem, written up in
[Chromium page breaks](/guides/chromium-pdf-page-breaks).

## Option 2: call an API

If the document is not confidential, you can skip the browser entirely:

```yaml
- uses: TrendTweekers/markdown-to-pdf-action@v1
  with:
    file: CHANGELOG.md
    output: dist/changelog.pdf
    page-numbers: true
```

A complete workflow that attaches the PDF to a release:

```yaml
name: Changelog PDF
on:
  release:
    types: [published]

jobs:
  pdf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: TrendTweekers/markdown-to-pdf-action@v1
        with:
          file: CHANGELOG.md
          output: dist/changelog.pdf
          page-numbers: true
          header-text: ${{ github.event.repository.name }} ${{ github.event.release.tag_name }}
          api-key: ${{ secrets.MINTPDF_API_KEY }}

      - uses: softprops/action-gh-release@v2
        with:
          files: dist/changelog.pdf
```

## The trap nobody mentions: shared runner IPs

If an API's free tier is rate-limited by IP address, GitHub's hosted runners are the worst possible
client. Thousands of repositories share those egress addresses. Your build is competing for an
anonymous allowance with strangers, and it will fail intermittently with a 429 that has nothing to do
with your usage.

So: authenticate scheduled workflows. Put the key in repository secrets and pass it in. This is true
of any API you call from CI, not just this one.

## The packaging detail: don't ship node_modules

This is the part worth stealing regardless of what your action does.

A JavaScript action has to have its dependencies present in the repository at the tag people
reference, because GitHub does not run `npm install` for you. The two usual answers are committing
`node_modules` (grim, and every audit finding is now yours) or bundling with `ncc` (a build step, and
reviewers get a minified blob).

There is a third option. A **composite action** can just run a file with the Node that every runner
already has:

```yaml
runs:
  using: 'composite'
  steps:
    - id: render
      shell: bash
      run: node "$GITHUB_ACTION_PATH/main.js"
      env:
        INPUT_FILE: ${{ inputs.file }}
        INPUT_OUTPUT: ${{ inputs.output }}
```

Node 18 and later has `fetch` and `fs` built in, which for an action that posts a file and writes the
response is everything you need. No dependencies, no lockfile, no bundle. Someone deciding whether to
trust your action reads one file.

Two things to know about composite actions:

**Inputs are not passed through automatically.** In a JavaScript action, `inputs.file` appears as
`INPUT_FILE` in the environment. In a composite action it does not. You must map every input under
`env:` yourself, as above. Silent empty strings are the symptom.

**Use `$GITHUB_ACTION_PATH`, not a relative path.** The step runs with the *caller's* workspace as the
working directory, so `node main.js` looks for the file in their repository, not yours.

Setting outputs is ordinary shell convention, appending to a file:

```js
const fs = require("node:fs");
fs.appendFileSync(process.env.GITHUB_OUTPUT, `size-bytes=${pdf.length}\n`);
```

and declaring them at the top level of `action.yml`:

```yaml
outputs:
  size-bytes:
    description: 'Size of the PDF in bytes.'
    value: ${{ steps.render.outputs.size-bytes }}
```

## Assert you got a PDF, not a web page

The failure I would actually expect in CI is not a crash. It is a 200 response containing an error
page, a login redirect, or an empty body, written to disk with a `.pdf` extension. Your workflow goes
green and the artifact is garbage.

Check the magic bytes:

```yaml
- name: Assert a real PDF was written
  run: |
    test -f dist/report.pdf
    head -c 4 dist/report.pdf | grep -q '%PDF'
    test "$(stat -c%s dist/report.pdf)" -gt 1000
```

Three lines, and they catch every version of that. The size floor matters too: a valid but nearly
empty PDF still starts with `%PDF`.

Worth testing the unhappy path as well, which most action repositories never do:

```yaml
- id: missing
  continue-on-error: true
  uses: ./
  with:
    file: does-not-exist.md
- run: test "${{ steps.missing.outcome }}" = "failure"
```

That asserts your action fails loudly on bad input instead of writing a zero-byte file and passing.

## Which one to use

Install Chromium when the content must not leave the runner, or when you need something an API cannot
give you, such as fonts you cannot redistribute. Accept the ~170MB download and the library list.

Call an API when the content is a changelog, a public report or generated documentation. Then the
whole thing is the three lines at the top of this page.

---

*The action above is [open source and MIT
licensed](https://github.com/TrendTweekers/markdown-to-pdf-action). It is a thin wrapper over
[MintPDF](https://mintpdf.dev), an HTML and Markdown to PDF API, which is what I maintain.*
