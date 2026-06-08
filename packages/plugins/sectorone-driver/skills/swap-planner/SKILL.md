---
name: swap-planner
description: Use when the user asks to swap on SectorOne, Joe DLMM, or LB on Base — "swap USDC for WETH on SectorOne", "trade on Joe Base", "SectorOne quote", "buy on DLMM Base". Plans the trade, verifies tokens on-chain, fetches pool hints via DexScreener/docs, and opens the SectorOne app. Does NOT require npm install or the SectorOne SDK. For unsigned calldata / Base MCP send_calls, use the sectorone-trading plugin instead.
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), WebFetch, WebSearch
license: MIT
metadata:
  author: dlmmskills
  version: "0.1.0"
  plugin: sectorone-driver
---

# SectorOne Swap Planner (Bankr-safe)

Plan SectorOne DLMM swaps on **Base mainnet only**. This skill is designed for **Bankr bots and chat-only agents** that cannot run `npm install` or clone the vendored SectorOne SDK.

> **When to escalate:** If the user needs **unsigned calldata**, **Base MCP `send_calls`**, or **exact on-chain quotes from the SDK**, switch to skill `dlmm-integration` (sectorone-trading plugin) after confirming shell + CLI install.

## Overview

1. Gather swap intent (tokens, amount, chain = Base).
2. Verify token contracts with `eth_getCode` (curl + RPC).
3. Optional: DexScreener for SectorOne/Joe pools on Base; SectorOne docs `?ask=` API for protocol questions.
4. Present summary + **open SectorOne app** (https://linktr.ee/SectorOneDEX) — user executes manually.

**No private keys. No local signing.**

## Step 1 — Gather intent

| Parameter | Required | Example |
| --- | --- | --- |
| Token in | Yes | USDC, WETH, address |
| Token out | Yes | WETH, address |
| Amount | Yes | `100` USDC |
| Chain | Base only | `8453` |

Reject non-Base chains.

## Step 2 — Resolve addresses

See `../../references/chains.md` for WETH/USDC on Base.

Validate addresses before shell use: `^0x[a-fA-F0-9]{40}$`

## Step 3 — Verify contracts (curl)

```bash
RPC="https://base-rpc.publicnode.com"
ADDR="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "$(jq -n --arg a "$ADDR" '{"jsonrpc":"2.0","method":"eth_getCode","params":[$a,"latest"],"id":1}')" \
  | jq -r '.result'
```

Result must not be `0x`.

## Step 4 — Pool / price hints (optional)

**DexScreener** (filter Base; dex id may vary — treat as hint only):

```bash
curl -s "https://api.dexscreener.com/latest/dex/tokens/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" \
  | jq '[.pairs[] | select(.chainId == "base")] | .[0:5] | map({dexId, pairAddress, priceUsd, liquidity: .liquidity.usd})'
```

**SectorOne docs** (protocol / pool types):

```bash
curl -sG "https://docs.sectorone.xyz/sectorone/welcome.md" \
  --data-urlencode "ask=Which LB version is default on Base mainnet?"
```

## Step 5 — Present plan + app link

```markdown
## SectorOne Swap Plan (Base)

| Field | Value |
| --- | --- |
| From | 100 USDC |
| To | WETH |
| Chain | Base (8453) |

### Notes
- DLMM uses bin liquidity — slippage depends on active bin depth.
- Default Joe 2.0 (v2) pools hold most Base liquidity.
- **Execute in SectorOne app:** https://linktr.ee/SectorOneDEX

### Need calldata instead?
Install `npx skills add DoctorTangle/dlmmskills --skill dlmm-integration` and clone the CLI repo (see sectorone-trading plugin).
```

## Safety

- Warn on tokens discovered only via web search (unverified).
- Do not invent deep-link URL parameters — SectorOne has no documented swap URL schema like Uniswap.
- For high slippage or large size, recommend conservative settings in the app.

## References

- `../../references/chains.md` — Base addresses and docs API
