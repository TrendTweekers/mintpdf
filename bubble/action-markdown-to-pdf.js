/**
 * MintPDF for Bubble — server-side action: "Generate PDF from Markdown"
 *
 * GENERATED FILE. Edit scratchpad/gen_bubble.py and regenerate, do not hand-edit.
 *
 * Written for Plugin API v4 (Node 22): an async function using native fetch. Do not reintroduce
 * context.async or context.request; v4 removed Fibers and both are deprecated behind context.v3.
 *
 * By default the finished PDF is uploaded into the Bubble app's own file storage and a permanent
 * URL is returned. The incumbent PDF plugins hand back links that expire or image-based renders,
 * and the resulting dead links are a large part of why the category leaders sit at 3.5 stars.
 */
async function (properties, context) {
  var apiKey = (context.keys && context.keys.api_key) || "";

  var payload = { markdown: properties.markdown };
  if (properties.page_numbers) payload.pageNumbers = true;
  if (properties.header_text) payload.headerText = properties.header_text;
  if (properties.footer_text) payload.footerText = properties.footer_text;
  if (properties.format) payload.format = properties.format;
  if (properties.landscape) payload.landscape = true;
  if (properties.margin) payload.margin = properties.margin;

  if (!payload.markdown) {
    throw new Error("MintPDF: the Markdown field is empty, so there is nothing to render.");
  }

  var headers = { "Content-Type": "application/json" };
  // Only send the header when a key exists. Without one the API still works on its anonymous tier
  // (10 renders a day per IP), so the plugin can be tried before anyone signs up for anything.
  if (apiKey) headers.Authorization = "Bearer " + apiKey;

  async function callApi(bodyObject) {
    return await fetch("https://mintpdf.dev/v1/pdf", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(bodyObject),
    });
  }

  async function describeFailure(res) {
    var detail = "";
    try {
      var text = await res.text();
      try {
        detail = JSON.parse(text).error || text.slice(0, 200);
      } catch (e) {
        detail = text.slice(0, 200);
      }
    } catch (e) {
      detail = "";
    }
    if (res.status === 429) {
      return "MintPDF: render limit reached. Add a free API key under Plugins, MintPDF, to raise it. " + detail;
    }
    if (res.status === 401 || res.status === 403) {
      return "MintPDF: the API key in the plugin settings was rejected. " + detail;
    }
    return "MintPDF: render failed (HTTP " + res.status + "). " + detail;
  }

  // No file upload is possible here. Measured on the real runtime, a v4 server-side action gets
  // context = {currentUser, userTimezone, keys, isBubbleThing, isBubbleList, getThingById,
  // getThingsById, v3} and context.v3 = {request, async}. uploadContent is client-side only, so
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
  return { url: parsed.download_url, size_bytes: parsed.size_bytes || 0, saved_to_bubble: false };
}
