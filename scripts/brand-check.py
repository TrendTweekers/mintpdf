#!/usr/bin/env python3
"""
Has the mintpdf.app name collision started costing us anything yet?

Decided 2026-08-13 to keep the name rather than pay the rebrand cost, on the reasoning that our
discovery is category queries ("markdown to pdf") and MCP registries, none of which the desktop
editor competes in. That reasoning holds only while nobody searches for us by name. This checks.

    python3 scripts/brand-check.py

Trigger to revisit: brand queries appear AND our average position on them is poor, which means
someone looked for us and found them. See docs/rebrand-cost.md.
"""
import datetime
import sys

KEY = "/mnt/c/Users/User/Documents/gsc-service-account.json"
SITE = "sc-domain:mintpdf.dev"
BRAND = ("mintpdf", "mint pdf", "mintpdf.dev")

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
except ImportError:
    sys.exit("needs google-api-python-client and google-auth")

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
svc = build("searchconsole", "v1", credentials=creds, cache_discovery=False)

end = datetime.date.today()
start = end - datetime.timedelta(days=28)


def query(dimensions, rows=200):
    body = {"startDate": start.isoformat(), "endDate": end.isoformat(),
            "dimensions": dimensions, "rowLimit": rows}
    return svc.searchanalytics().query(siteUrl=SITE, body=body).execute().get("rows", [])


totals = query([], 1)
t = totals[0] if totals else {"impressions": 0, "clicks": 0}
print(f"  last 28d: {t.get('impressions', 0)} impressions, {t.get('clicks', 0)} clicks")

# Query rows stay hidden until a term clears Google's anonymisation threshold, so an empty result
# here means "too small to report", NOT "nobody searched". Say so rather than implying safety.
rows = query(["query"])
if not rows:
    print("  no query data yet: every term is below Google's anonymisation threshold.")
    print("  VERDICT: cannot tell yet. Nothing to act on. Re-run when impressions reach the hundreds.")
    sys.exit(0)

brand = [r for r in rows if any(b in r["keys"][0].lower() for b in BRAND)]
print(f"  {len(rows)} visible queries, {len(brand)} of them brand terms")

if not brand:
    print("  VERDICT: no brand searches yet. The collision is still costing nothing. Keep the name.")
    sys.exit(0)

print("\n  brand queries:")
worst = 0.0
for r in sorted(brand, key=lambda x: -x["impressions"]):
    pos = r["position"]
    worst = max(worst, pos)
    print(f"    {r['keys'][0][:42]:44} imp={r['impressions']:>4} clicks={r['clicks']:>3} pos={pos:.1f}")

print()
if worst > 5:
    print(f"  VERDICT: people are searching for us by name and we average position {worst:.1f}.")
    print("  That is the rebrand trigger from docs/rebrand-cost.md. Read it and decide.")
else:
    print("  VERDICT: brand searches exist and we rank well on them. Keep the name, keep watching.")
