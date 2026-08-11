"""Generate the three Bubble server-side action files from one template.

Bubble gives each action an isolated code box, so the actions cannot share a helper module. Rather
than maintain three near-identical files by hand and let them drift, they are generated.

Targets **Plugin API v4** (Node 22). v4 dropped the Fibers extension, which is what made the old
`context.async` and `context.request` appear synchronous. Both are deprecated and moved to
`context.v3.*`; the modern shape is a plain `async function` using native `fetch`. Writing against
the older callback API fails at runtime with "TypeError: context.async is not a function", which is
exactly how this was caught.
"""
from pathlib import Path

TEMPLATE = '''/**
 * MintPDF for Bubble — server-side action: "{title}"
 *
 * GENERATED FILE. Edit scratchpad/gen_bubble.py and regenerate, do not hand-edit.
 *
 * Written for Plugin API v4 (Node 22): an async function using native fetch. Do not reintroduce
 * context.async or context.request; v4 removed Fibers and both are deprecated behind context.v3.
 *
 * Returns a hosted MintPDF link, valid for one hour. Storing the file in the app's own storage is
 * NOT possible here: a v4 server-side action receives no file upload API (see the note lower down).
 * The advantage over the incumbents is render quality, not permanence: real selectable text and
 * correct page breaks, rather than a screenshot of the page wrapped in a PDF.
 */
async function (properties, context) {{
  var apiKey = (context.keys && context.keys.api_key) || "";

  var payload = {{ {field}: properties.{field} }};
  if (properties.page_numbers) payload.pageNumbers = true;
  if (properties.header_text) payload.headerText = properties.header_text;
  if (properties.footer_text) payload.footerText = properties.footer_text;
  if (properties.format) payload.format = properties.format;
  if (properties.landscape) payload.landscape = true;
  if (properties.margin) payload.margin = properties.margin;

  if (!payload.{field}) {{
    throw new Error("MintPDF: {empty_msg}");
  }}

  var headers = {{ "Content-Type": "application/json" }};
  // Only send the header when a key exists. Without one the API still works on its anonymous tier
  // (10 renders a day per IP), so the plugin can be tried before anyone signs up for anything.
  if (apiKey) headers.Authorization = "Bearer " + apiKey;

  async function callApi(bodyObject) {{
    return await fetch("https://mintpdf.dev/v1/pdf", {{
      method: "POST",
      headers: headers,
      body: JSON.stringify(bodyObject),
    }});
  }}

  async function describeFailure(res) {{
    var detail = "";
    try {{
      var text = await res.text();
      try {{
        detail = JSON.parse(text).error || text.slice(0, 200);
      }} catch (e) {{
        detail = text.slice(0, 200);
      }}
    }} catch (e) {{
      detail = "";
    }}
    if (res.status === 429) {{
      return "MintPDF: render limit reached. Add a free API key under Plugins, MintPDF, to raise it. " + detail;
    }}
    if (res.status === 401 || res.status === 403) {{
      return "MintPDF: the API key in the plugin settings was rejected. " + detail;
    }}
    return "MintPDF: render failed (HTTP " + res.status + "). " + detail;
  }}

  // No file upload is possible here. Measured on the real runtime, a v4 server-side action gets
  // context = {{currentUser, userTimezone, keys, isBubbleThing, isBubbleList, getThingById,
  // getThingsById, v3}} and context.v3 = {{request, async}}. uploadContent is client-side only, so
  // storing the PDF in the app's own file storage cannot be done from here whatever we call it.
  //
  // The action therefore returns the hosted MintPDF link, which is valid for one hour.
  // saved_to_bubble is kept in the return shape and always false, so any app already reading it
  // keeps working and the honest answer is visible in the workflow.
  var linkPayload = JSON.parse(JSON.stringify(payload));
  linkPayload.output = "url";
  var linkRes = await callApi(linkPayload);
  if (!linkRes.ok) throw new Error(await describeFailure(linkRes));
  var parsed = await linkRes.json();
  return {{ url: parsed.download_url, size_bytes: parsed.size_bytes || 0, saved_to_bubble: false }};
}}
'''

ACTIONS = [
    {
        "slug": "markdown-to-pdf",
        "title": "Generate PDF from Markdown",
        "field": "markdown",
        "empty_msg": "the Markdown field is empty, so there is nothing to render.",
    },
    {
        "slug": "html-to-pdf",
        "title": "Generate PDF from HTML",
        "field": "html",
        "empty_msg": "the HTML field is empty, so there is nothing to render.",
    },
    {
        "slug": "url-to-pdf",
        "title": "Generate PDF from a web page",
        "field": "url",
        "empty_msg": "the URL field is empty. Provide a public http or https address.",
    },
]

out_dir = Path("/home/plastgaffel/pdfmint/bubble")
out_dir.mkdir(parents=True, exist_ok=True)
for a in ACTIONS:
    path = out_dir / f"action-{a['slug']}.js"
    path.write_text(TEMPLATE.format(**a), encoding="utf-8")
    print("wrote", path)
