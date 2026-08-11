/**
 * MintPDF for Bubble — server-side action: "Generate PDF from a web page"
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

  var payload = { url: properties.url };
  if (properties.page_numbers) payload.pageNumbers = true;
  if (properties.header_text) payload.headerText = properties.header_text;
  if (properties.footer_text) payload.footerText = properties.footer_text;
  if (properties.format) payload.format = properties.format;
  if (properties.landscape) payload.landscape = true;
  if (properties.margin) payload.margin = properties.margin;

  if (!payload.url) {
    throw new Error("MintPDF: the URL field is empty. Provide a public http or https address.");
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

  // uploadContent is callback-based in older docs and promise-based in newer ones, and the version
  // is not documented for v4. Pass a callback AND honour a returned thenable, so one upload happens
  // either way rather than guessing and uploading twice or hanging forever.
  function uploadContent(name, base64) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var maybe = context.uploadContent(name, base64, function (err, url) {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve(url);
      });
      if (maybe && typeof maybe.then === "function") {
        maybe.then(
          function (url) {
            if (settled) return;
            settled = true;
            resolve(url);
          },
          function (err) {
            if (settled) return;
            settled = true;
            reject(err);
          },
        );
      }
    });
  }

  // A link was asked for rather than a stored file, so let the API produce it directly instead of
  // uploading bytes we would then throw away. The link is valid for one hour.
  //
  // Deliberately opt-IN. Bubble offers no per-field default, so an unticked checkbox arrives as
  // false; phrasing this as "save_to_bubble" would have made the temporary link the default, which
  // is the opposite of the behaviour that makes this plugin worth installing.
  if (properties.temporary_link === true) {
    var linkPayload = JSON.parse(JSON.stringify(payload));
    linkPayload.output = "url";
    var linkRes = await callApi(linkPayload);
    if (!linkRes.ok) throw new Error(await describeFailure(linkRes));
    var parsed = await linkRes.json();
    return { url: parsed.download_url, size_bytes: parsed.size_bytes || 0, saved_to_bubble: false };
  }

  var res = await callApi(payload);
  if (!res.ok) throw new Error(await describeFailure(res));

  var pdf = Buffer.from(await res.arrayBuffer());
  var sizeBytes = pdf.length;

  // Bubble base64-encodes uploads, inflating them by about 4/3, and its guidance is to stay under
  // 5MB. Fail with a clear message rather than letting the platform truncate silently.
  if (sizeBytes > 5 * 1024 * 1024) {
    throw new Error(
      "MintPDF: the rendered PDF is " +
        Math.round(sizeBytes / 1024 / 1024) +
        "MB, above Bubble's 5MB practical limit for stored files. Split the document, or tick " +
        '"Return a temporary link instead" to get a download link.',
    );
  }

  var name = properties.filename || "document.pdf";
  if (name.slice(-4).toLowerCase() !== ".pdf") name = name + ".pdf";

  var storedUrl = await uploadContent(name, pdf.toString("base64"));

  return { url: storedUrl, size_bytes: sizeBytes, saved_to_bubble: true };
}
