/**
 * Umami, self-contained so every page template shares one definition.
 *
 * data-domains keeps the *.up.railway.app preview host out of the numbers: without it every deploy
 * check and every uptime probe against the Railway domain lands in the same dashboard as real
 * traffic. Only mintpdf.dev reports.
 *
 * Deliberately kept alongside the first-party /v1/beacon rather than replacing it. Umami cannot see
 * server-side facts (renders via the REST API and MCP, keys issued, quota rejections), and those
 * drive /admin/stats. The two answer different questions.
 */
const UMAMI_ID = "7a43ccd2-b47d-45c2-bb22-05fc5fd46daa";

export const ANALYTICS = `<script defer src="https://cloud.umami.is/script.js" data-website-id="${UMAMI_ID}" data-domains="mintpdf.dev"></script>`;

/**
 * Fire a custom event without assuming Umami loaded. It is deferred and third party, so it may be
 * blocked, slow, or absent entirely. Never let that break the page it is measuring.
 */
export const TRACK_FN = `
  function track(name, data) {
    try { if (window.umami && window.umami.track) window.umami.track(name, data || {}); } catch (e) {}
  }`;
