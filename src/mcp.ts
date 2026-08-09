import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { htmlToPdf, markdownToPdf, urlToPdf, PdfOptions } from "./pdf.js";
import { storePdf } from "./store.js";

const optionsShape = {
  format: z.enum(["A4", "Letter", "Legal", "A3", "A5"]).optional().describe("Paper size, default A4"),
  landscape: z.boolean().optional().describe("Landscape orientation, default false"),
  margin: z.string().optional().describe('Page margin on all sides, e.g. "18mm"'),
  pageNumbers: z.boolean().optional().describe("Show page numbers in the footer"),
  headerText: z.string().optional().describe("Small header text on every page"),
  footerText: z.string().optional().describe("Small footer text on every page"),
};

type OptionArgs = { [K in keyof typeof optionsShape]?: unknown };

function toPdfOptions(args: OptionArgs): PdfOptions {
  return {
    format: args.format as PdfOptions["format"],
    landscape: args.landscape as boolean | undefined,
    margin: args.margin as string | undefined,
    pageNumbers: args.pageNumbers as boolean | undefined,
    headerText: args.headerText as string | undefined,
    footerText: args.footerText as string | undefined,
  };
}

function pdfResult(pdf: Buffer, baseUrl: string) {
  const { id, expiresAt } = storePdf(pdf);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          download_url: `${baseUrl}/f/${id}`,
          expires_at: expiresAt,
          size_bytes: pdf.length,
        }),
      },
    ],
  };
}

export function buildMcpServer(baseUrl: string): McpServer {
  const server = new McpServer({ name: "pdfmint", version: "0.1.0" });

  server.registerTool(
    "generate_pdf",
    {
      title: "Generate a PDF from HTML or Markdown",
      description:
        "Renders HTML or Markdown into a PDF and returns a download URL (valid for 1 hour). " +
        "Provide exactly one of `html` or `markdown`. Markdown gets a clean default stylesheet, " +
        "so it is the fastest way to produce a good-looking document.",
      inputSchema: {
        html: z.string().optional().describe("Full HTML document or fragment to render"),
        markdown: z.string().optional().describe("Markdown content to render with the default stylesheet"),
        ...optionsShape,
      },
    },
    async (args) => {
      const { html, markdown } = args as { html?: string; markdown?: string };
      if (!html === !markdown) {
        throw new Error("Provide exactly one of `html` or `markdown`.");
      }
      const opts = toPdfOptions(args as OptionArgs);
      const pdf = html ? await htmlToPdf(html, opts) : await markdownToPdf(markdown as string, opts);
      return pdfResult(pdf, baseUrl);
    },
  );

  server.registerTool(
    "pdf_from_url",
    {
      title: "Generate a PDF from a public URL",
      description:
        "Loads a public web page and renders it to PDF. Returns a download URL valid for 1 hour. " +
        "Only public http/https URLs are allowed.",
      inputSchema: {
        url: z.string().url().describe("Public http(s) URL of the page to render"),
        ...optionsShape,
      },
    },
    async (args) => {
      const { url } = args as { url: string };
      const pdf = await urlToPdf(url, { ...toPdfOptions(args as OptionArgs), waitForNetworkIdle: true });
      return pdfResult(pdf, baseUrl);
    },
  );

  return server;
}

/** Stateless request handler: fresh server+transport per POST, per MCP streamable-http spec. */
export async function handleMcpRequest(
  baseUrl: string,
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: unknown,
): Promise<void> {
  const server = buildMcpServer(baseUrl);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}
