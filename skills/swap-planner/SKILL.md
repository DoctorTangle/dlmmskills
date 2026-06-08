---
name: swap-planner
description: Use when the user asks to swap on SectorOne, Joe DLMM, or LB on Base — "swap USDC for WETH on SectorOne", "trade on Joe Base", "SectorOne quote", "buy on DLMM Base". Plans the trade, verifies tokens on-chain, fetches pool hints via DexScreener/docs, and opens the SectorOne app. Does NOT require npm install or the SectorOne SDK. For unsigned calldata / Base MCP send_calls, use dlmm-integration instead.
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), WebFetch, WebSearch
license: MIT
metadata:
  author: dlmmskills
  version: "0.1.0"
  plugin: sectorone-driver
---

# SectorOne Swap Planner (Bankr-safe)

Plan SectorOne DLMM swaps on **Base mainnet only**. For **Bankr bots** that cannot run `npm install` or clone the vendored SectorOne SDK.

> Escalate to **`dlmm-integration`** for unsigned calldata / Base MCP `send_calls`.

## Workflow

1. Gather swap intent (tokens, amount, Base only).
2. Verify tokens: `eth_getCode` via curl (see [references/chains.md](references/chains.md)).
3. Optional: DexScreener + SectorOne docs `?ask=` API.
4. Present plan + open https://linktr.ee/SectorOneDEX

## Verify contract

```bash
RPC="https://base-rpc.publicnode.com"
ADDR="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "$(jq -n --arg a "$ADDR" '{"jsonrpc":"2.0","method":"eth_getCode","params":[$a,"latest"],"id":1}')" \
  | jq -r '.result'
```

## DexScreener hint

```bash
curl -s "https://api.dexscreener.com/latest/dex/tokens/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" \
  | jq '[.pairs[] | select(.chainId == "base")] | .[0:5]'
```

## Docs API

```bash
curl -sG "https://docs.sectorone.xyz/sectorone/welcome.md" \
  --data-urlencode "ask=Which LB version is default on Base?"
```

## Safety

- No private keys. No invented deep-link URLs (SectorOne has no Uniswap-style swap URL schema).
- Warn on web-discovered token addresses.

Install calldata skill: `npx skills add DoctorTangle/dlmmskills --skill dlmm-integration`

See [docs/BANKR.md](../../docs/BANKR.md).
