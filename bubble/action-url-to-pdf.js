/**
 * MintPDF for Bubble — server-side action: "Generate PDF from a web page"
 *
 * GENERATED FILE. Edit scratchpad/gen_bubble.py and regenerate, do not hand-edit.
 *
 * Paste this into the plugin editor's code box for the action. It has to be self-contained: Bubble
 * gives each action its own sandbox, so the helpers below are duplicated across the three actions on
 * purpose rather than factored out.
 *
 * Design note. By default this uploads the finished PDF into the Bubble app's own file storage and
 * returns a permanent URL. Every incumbent PDF plugin either hands back a temporary link or an
 * image-based render, and the resulting dead links are a large part of why the category leaders sit
 * at 3.5 stars. Storing the file where the app already keeps its files is what a Bubble user expects.
 */
function (properties, context) {
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
  // (10 renders a day per IP), so someone can try the plugin before signing up for anything.
  if (apiKey) headers.Authorization = "Bearer " + apiKey;

  function callApi(bodyObject, wantBytes) {
    return context.async(function (callback) {
      var options = {
        method: "POST",
        uri: "https://mintpdf.dev/v1/pdf",
        headers: headers,
        body: JSON.stringify(bodyObject),
      };
      // encoding null gives us a Buffer. Never combine it with json:true, which would try to parse
      // the PDF bytes as JSON and hand back mangled output.
      if (wantBytes) options.encoding = null;
      context.request(options, function (err, response, body) {
        if (err) return callback(err);
        callback(null, { status: response.statusCode, body: body });
      });
    });
  }

  function describeFailure(res) {
    var detail = "";
    try {
      detail = JSON.parse(res.body.toString("utf8")).error || "";
    } catch (e) {
      detail = res.body ? String(res.body).slice(0, 200) : "";
    }
    if (res.status === 429) {
      return (
        "MintPDF: render limit reached. Add a free API key under Plugins, MintPDF, to raise it. " +
        detail
      );
    }
    if (res.status === 401 || res.status === 403) {
      return "MintPDF: the API key in the plugin settings was rejected. " + detail;
    }
    return "MintPDF: render failed (HTTP " + res.status + "). " + detail;
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
    var linkRes = callApi(linkPayload, false);
    if (linkRes.status !== 200) throw new Error(describeFailure(linkRes));
    var parsed = JSON.parse(linkRes.body);
    return { url: parsed.download_url, size_bytes: parsed.size_bytes || 0, saved_to_bubble: false };
  }

  var res = callApi(payload, true);
  if (res.status !== 200) throw new Error(describeFailure(res));

  var pdf = res.body;
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

  var storedUrl = context.async(function (callback) {
    context.uploadContent(name, pdf.toString("base64"), callback);
  });

  return { url: storedUrl, size_bytes: sizeBytes, saved_to_bubble: true };
}
