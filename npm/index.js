#!/usr/bin/env node
/**
 * MintPDF MCP server (stdio).
 *
 * Exposes the same two tools as the hosted endpoint, so any MCP client can install it with
 * `npx -y mintpdf-mcp` instead of configuring a remote transport.
 *
 * Environment:
 *   MINTPDF_API_KEY   optional; raises the monthly limit (get one free at the site)
 *   MINTPDF_BASE_URL  optional; point at your own instance if you self-host
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.MINTPDF_BASE_URL ?? "https://mintpdf.dev").replace(/\/$/, "");
const API_KEY = process.env.MINTPDF_API_KEY ?? "";

const options = {
  format: z.enum(["A4", "Letter", "Legal", "A3", "A5"]).optional().describe("Paper size, default A4"),
  landscape: z.boolean().optional().describe("Landscape orientation, default false"),
  margin: z.string().optional().describe('Margin on all sides, e.g. "18mm"'),
  pageNumbers: z.boolean().optional().describe("Show page numbers in the footer"),
  headerText: z.string().optional().describe("Small header text on every page"),
  footerText: z.string().optional().describe("Small footer text on every page"),
};

function pickOptions(args) {
  const { format, landscape, margin, pageNumbers, headerText, footerText } = args;
  return { format, landscape, margin, pageNumbers, headerText, footerText };
}

async function render(body) {
  const res = await fetch(`${BASE_URL}/v1/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({ ...body, output: "url" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ? `${data.error}${data.hint ? ` — ${data.hint}` : ""}` : `request failed (${res.status})`);
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          download_url: data.download_url,
          expires_at: data.expires_at,
          size_bytes: data.size_bytes,
        }),
      },
    ],
  };
}

const server = new McpServer({ name: "mintpdf", version: "0.1.0" });

server.registerTool(
  "generate_pdf",
  {
    title: "Generate a PDF from HTML or Markdown",
    description:
      "Renders HTML or Markdown into a PDF and returns a download URL valid for one hour. " +
      "Provide exactly one of `html` or `markdown`. Markdown is styled with a clean default " +
      "stylesheet, so it is the quickest way to produce a presentable document.",
    inputSchema: {
      html: z.string().optional().describe("Full HTML document or fragment to render"),
      markdown: z.string().optional().describe("Markdown content, rendered with the default stylesheet"),
      ...options,
    },
  },
  async (args) => {
    const { html, markdown } = args;
    if (!html === !markdown) throw new Error("Provide exactly one of `html` or `markdown`.");
    return render({ ...(html ? { html } : { markdown }), ...pickOptions(args) });
  },
);

server.registerTool(
  "pdf_from_url",
  {
    title: "Generate a PDF from a public URL",
    description:
      "Loads a public web page and renders it to PDF, returning a download URL valid for one hour. " +
      "Only public http/https addresses are allowed.",
    inputSchema: {
      url: z.string().url().describe("Public http(s) URL of the page to render"),
      ...options,
    },
  },
  async (args) => render({ url: args.url, ...pickOptions(args) }),
);

await server.connect(new StdioServerTransport());
