# MintPDF for Bubble

A Bubble plugin wrapping the MintPDF API: Markdown or HTML in, finished PDF out, saved straight into
the app's own file storage.

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

Shared fields on every action:

| Key | Type | Default | Notes |
|---|---|---|---|
| `filename` | Text | `document.pdf` | `.pdf` is appended if missing |
| `save_to_bubble` | Checkbox | checked | Off returns a MintPDF link valid one hour instead |
| `page_numbers` | Checkbox | unchecked | Adds `3 / 7` to the footer |
| `header_text` | Text | empty | Small running text on every page |
| `footer_text` | Text | empty | |
| `format` | Text | empty | `A4`, `Letter`, `Legal`, `A3`, `A5` |
| `landscape` | Checkbox | unchecked | |
| `margin` | Text | empty | All sides, e.g. `18mm` |

Returned values on every action:

| Key | Type |
|---|---|
| `url` | Text |
| `size_bytes` | Number |
| `saved_to_bubble` | Checkbox |

No npm dependencies are needed. The actions use `context.request`, `context.async` and
`context.uploadContent`, all provided by the platform.

## Testing

The actions are exercised against the live API before release:

```bash
node scratchpad/bubble_harness.mjs
```

The harness fakes Bubble's `context` and, importantly, makes each HTTP call synchronously. Bubble's
`context.async` only *looks* synchronous because their runtime uses fibers, so a naive async shim
would test an ordering the platform never produces. Last run: 5/5, with valid multi-page PDFs.

## Regenerating the actions

The three action files are generated from one template so they cannot drift:

```bash
python3 scratchpad/gen_bubble.py
```

Edit the template, never the generated files.
