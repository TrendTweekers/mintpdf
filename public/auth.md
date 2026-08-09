# Authentication for agents

MintPDF does not use OAuth. Authentication is a single bearer token, called an API key, and the key
is the account: there is no separate login, password, or dashboard.

## No key at all

The API works without any credential for a small number of renders per day per IP address. An agent
can call it immediately with no registration step.

## Getting a key (no card, no confirmation email)

```bash
curl -X POST https://mintpdf.dev/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
# → {"key":"pm_...","daily_limit":100}
```

The response contains the key immediately. There is no verification loop to wait on.

## Using the key

```
Authorization: Bearer pm_...
```

For the MCP package, set it as the `MINTPDF_API_KEY` environment variable.

## Rate limits

| Tier | Limit |
|---|---|
| Anonymous | 3 renders/day per IP |
| Free key | 100 renders/month |
| Solo ($19/month) | 2,000 renders/month |

Exceeding a limit returns HTTP 429 with a JSON body explaining which limit was reached.

## Upgrading

`POST /v1/upgrade` with `{"key":"pm_..."}` returns a hosted checkout URL. On payment the same key is
raised to the higher limit; nothing else changes and no new credential is issued.

## Lost keys

There is no login to recover, so recovery works through the email address instead: request a key
again with the same address.

```bash
curl -X POST https://mintpdf.dev/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

If that address has a paid subscription, it moves to the new key automatically and the response says
so. The previous key drops to the free tier immediately, so a lost or leaked key stops being able to
spend your quota.

## Revocation

Keys do not expire. To retire one, request a new key with the same email: the old one is demoted the
moment the new one is issued.
