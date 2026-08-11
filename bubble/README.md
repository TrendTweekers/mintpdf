# MintPDF for Bubble

A Bubble plugin wrapping the MintPDF API: Markdown or HTML in, finished PDF out.

> **Measured constraint.** A v4 server-side action receives
> `context = {currentUser, userTimezone, keys, isBubbleThing, isBubbleList, getThingById,`
> `getThingsById, v3}` and `context.v3 = {request, async}`. **There is no file upload API.**
> `uploadContent` is client-side only. Storing the PDF in the app's own file storage therefore
> cannot be done from a server-side action, so the actions return the hosted MintPDF link, valid for
> one hour. Restoring permanent storage needs a different mechanism (a client-side action, or longer
> retention for plugin users) and is an open product question, not a bug.

## Why this exists, and why it is free

Bubble's PDF category has 283 plugins, and the leaders are rated 3.5 to 3.8 with tens of thousands of
installs each. They split into two approaches, both of which produce complaints:

- **Screenshot / page-to-PDF**: renders the visible page to an image and wraps it in a PDF. Text is
  not selectable, output is blurry at print sizes, and page breaks land wherever they land.
- **Programmatic builders**: you construct the document element by element, which means rebuilding
  your layout a second time in a different language.

Nobody offers "content in, styled document out". Bubble users also cannot self-host a renderer, so
unlike most audiences they have no free workaround.

**The plugin is free and asks the user for their own MintPDF API key.** It is not sold for a one-off
fee, because a one-off fee against unlimited server-side rendering is unbounded cost per sale. Free
also means no revenue share and the widest possible install base, and the plugin then feeds MintPDF's
own tiers. It works with no key at all on the anonymous tier, so it can be tried before anyone signs
up for anything.

## Building it in the plugin editor

Bubble plugins are authored in their web editor; there is no file-based workflow. These files are the
source of truth, to be pasted in.

### Plugin settings (shared keys)

One key, exposed to the action code as `context.keys.api_key`:

| Name | Type | Description shown to the user |
|---|---|---|
| `api_key` | Text (not private) | Your MintPDF API key. Leave empty to use the free anonymous tier, 10 renders a day. Get a key at https://mintpdf.dev |

### Actions

Three server-side actions. Each is "Action - Server side", and each takes the same shared fields
below plus its own source field.

| Action | Source field | Code |
|---|---|---|
| Generate PDF from Markdown | `markdown` (Text, long) | [`action-markdown-to-pdf.js`](action-markdown-to-pdf.js) |
| Generate PDF from HTML | `html` (Text, long) | [`action-html-to-pdf.js`](action-html-to-pdf.js) |
| Generate PDF from a web page | `url` (Text) | [`action-url-to-pdf.js`](action-url-to-pdf.js) |

**`temporary_link` is deliberately opt-in rather than a `save_to_bubble` opt-out.** Bubble offers no
per-field default, so an unticked checkbox arrives as `false`. Phrasing it the other way round would
have made the expiring link the default, which is the opposite of the behaviour that makes this
plugin worth installing.

Shared fields on every action. **v1 ships only the first four.** The code reads every optional
property defensively, so the rest can be added in a later version without touching it, and an absent
`save_to_bubble` correctly defaults to storing the file. Each field costs a dropdown interaction in
their editor, and nobody installs a PDF plugin because it supports A3.

| Key | Type | Default | v1 | Notes |
|---|---|---|---|---|
| `filename` | Text | `document.pdf` | yes | `.pdf` is appended if missing |
| `temporary_link` | Checkbox | unchecked | yes | Tick to get a MintPDF link valid one hour instead of a stored file |
| `page_numbers` | Checkbox | unchecked | yes | Adds `3 / 7` to the footer |
| `header_text` | Text | empty | later | Small running text on every page |
| `footer_text` | Text | empty | later | |
| `format` | Text | empty | later | `A4`, `Letter`, `Legal`, `A3`, `A5` |
| `landscape` | Checkbox | unchecked | later | |
| `margin` | Text | empty | later | All sides, e.g. `18mm` |

Returned values on every action:

| Key | Type |
|---|---|
| `url` | Text |
| `size_bytes` | Number |
| `saved_to_bubble` | Checkbox |

No npm dependencies are needed.

**These actions target Plugin API v4 (Node 22).** v4 dropped the Fibers extension, so `context.async`
and `context.request` no longer exist at the top level: they are deprecated behind `context.v3.*`.
The actions are plain `async function`s using native `fetch`. Writing against the older callback API
fails at runtime with `TypeError: context.async is not a function`, which is how this was caught, in
Bubble, after the harness had wrongly passed it.

## Testing

The actions are exercised against the live API before release:

```bash
node scratchpad/bubble_harness.mjs
```

The harness now stubs only `context.uploadContent`, the one thing that exists solely inside Bubble.
Every HTTP call is real. It runs the upload both callback-style and promise-style, because Bubble's
own docs disagree on which `uploadContent` is and the action has to survive either. Last run: 7/7.

Set `MINTPDF_KEY` when running it, or the anonymous 10-a-day limit will exhaust part way through and
look like a code failure.

An earlier version of this harness emulated the v3 fiber-backed `context.async`. It passed while the
plugin was broken in Bubble, because it was reproducing an API the platform no longer has. A test
that invents its own runtime proves nothing about the real one.

## Regenerating the actions

The three action files are generated from one template so they cannot drift:

```bash
python3 scratchpad/gen_bubble.py
```

Edit the template, never the generated files.
