---
name: liquidity-planner
description: Use when the user asks to add or remove liquidity on SectorOne DLMM on Base — "provide liquidity SectorOne", "LP on Joe Base", "DLMM bins", "remove liquidity SectorOne". Plans bin/range context and opens the SectorOne app. Does NOT require npm install. For calldata (build-add/remove-liquidity), use sectorone-trading.
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), WebFetch, WebSearch
license: MIT
metadata:
  author: dlmmskills
  version: "0.1.0"
  plugin: sectorone-driver
---

# SectorOne Liquidity Planner (Bankr-safe)

Help users **plan** DLMM liquidity on Base without the vendored SDK.

## Workflow

1. Confirm **Base mainnet** and token pair (addresses + decimals).
2. Explain **bin step** and **active bin** concept (liquidity is bin-local).
3. Optional: query docs API for vaults/farms/pool types.
4. Direct user to **SectorOne app**: https://linktr.ee/SectorOneDEX

## DLMM reminders

- **v2 (Joe 2.0)** is default on Base for most pools.
- **v2.1** is not on Base; use **v22** only for v2.2-factory pools.
- Removing liquidity requires knowing **bin IDs** — in the full CLI: `read-position` then `build-remove-liquidity`.

## Docs query

```bash
curl -sG "https://docs.sectorone.xyz/sectorone/welcome.md" \
  --data-urlencode "ask=How do DLMM bins and bin step work on Base?"
```

## Escalation to CLI

When the user wants **unsigned transactions** for Base MCP:

```bash
npx skills add DoctorTangle/dlmmskills --skill dlmm-integration
git clone https://github.com/DoctorTangle/dlmmskills.git && cd dlmmskills && npm install
npm run sectorone -- read-pool --token-x ... --token-y ... --bin-step 25 --json
npm run sectorone -- build-add-liquidity --wallet ... --json
npm run sectorone -- build-remove-liquidity --bin-ids ... --remove-all --json
```

See `../../references/chains.md`.
