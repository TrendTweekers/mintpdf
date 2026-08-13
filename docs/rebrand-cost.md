# What a rebrand actually costs

Written 2026-08-13, after finding that mintpdf.app (Simy Dev Labs LLC, Minnesota) is an established
desktop PDF editor with the same name in the same category. No registered trademark found, so this is
a judgment call rather than a forced move.

## Survives a rename, cheaply

| thing | how |
|---|---|
| The code | Identical. It is a rename, not a rewrite. |
| GitHub repo | Rename in settings; GitHub redirects the old path indefinitely. |
| dev.to backlink + canonical | 301 from the old domain carries almost all of it. Keep mintpdf.dev alive and redirecting, do not let it lapse. |
| Guides, converter pages, sitemap | Rebuild automatically from `content/` and the renderers. |
| Railway, Cloudflare, Polar, Telegram bot | Config changes, minutes each. |
| GSC / Bing / IndexNow | Re-verify the new domain, resubmit sitemap. Half an hour, and the current search footprint is 11 impressions, so nothing is being thrown away. |

## Has to be redone, and cannot be moved

| thing | why |
|---|---|
| **npm `mintpdf-mcp`** | Package names are permanent. Publish a new name, deprecate the old pointing at it. Installs referencing the old name keep working. |
| **MCP registry `io.github.TrendTweekers/mintpdf`** | Namespace is tied to the repo name; needs a new entry. |
| **Glama listing** | Graded **A** after a genuinely painful config fight (bookworm base image, pinned SHA, the release flow). All of that would be repeated. |
| **Smithery, Cline, PulseMCP, getmcp.dev, mcpservers.org** | Resubmit each; mcpservers.org took days to approve. |
| **Postman catalog submission** | Currently pending with api-network@postman.com. Would need withdrawing and resubmitting. |
| **Show HN** | Permanent and unrepeatable. HN does not welcome the same project reposted under a new name. |
| **GHCR image, GitHub Action, VS Code publisher** | Rebuild and republish. |

## The timing argument

The cost of this is **at its lowest point it will ever be**: 11 search impressions, 0 clicks, 0 paying
customers, one backlink, six days of age. Every week of ranking, every customer, and every additional
directory listing makes it more expensive. If it is going to happen, it happens now.

## The argument that actually matters

Not the legal one. **Distribution.** This product's whole discovery model is AI agents and developers
asking about MCP servers. Kimi was asked to research MintPDF and returned a marketing plan for the
desktop editor: one-time pricing, offline, "your PDFs never touch a server". Every assistant answering
"what is MintPDF" will keep doing that, because the established product wins. A brand you cannot own
in the channel you depend on is a permanent tax.

Against that: name collisions across `.app` / `.dev` are common, the other party is a small LLC, and
nothing has been asserted against us.

## If we go ahead, the order

1. Pick the name. Check npm, GitHub org, the MCP registry, and a plain Google search **before** buying
   anything. This is the step that failed last time.
2. Register the domain; keep mintpdf.dev renewed and 301-redirecting, permanently.
3. Rename the GitHub repo, publish the new npm package, deprecate the old one.
4. New MCP registry entry, new container image.
5. Re-verify GSC and Bing, resubmit sitemaps, run IndexNow.
6. Resubmit the directories, worst first: Glama takes longest.
7. Update the dev.to article's canonical to the new guide URL.
8. Withdraw and resubmit the Postman catalog submission.

Realistically **one to two focused days**, most of it waiting on other people's review queues.
