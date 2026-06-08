---
name: liquidity-planner
description: Use when the user asks to add or remove liquidity on SectorOne DLMM on Base — "provide liquidity SectorOne", "LP on Joe Base", "DLMM bins", "remove liquidity SectorOne". Opens the SectorOne app; no npm install. For calldata use dlmm-integration.
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), WebFetch, WebSearch
license: MIT
metadata:
  author: dlmmskills
  version: "0.1.0"
  plugin: sectorone-driver
---

# SectorOne Liquidity Planner (Bankr-safe)

Plan DLMM liquidity on Base without the SDK.

1. Confirm pair + **bin step** (liquidity is bin-local).
2. Query docs: `GET https://docs.sectorone.xyz/sectorone/welcome.md?ask=...`
3. Direct user to https://linktr.ee/SectorOneDEX

**Remove LP:** needs bin IDs — full CLI: `read-position` + `build-remove-liquidity` (see `dlmm-integration`).

Base addresses: [../swap-planner/references/chains.md](../swap-planner/references/chains.md)

See [docs/BANKR.md](../../docs/BANKR.md).
