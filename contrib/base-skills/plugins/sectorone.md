---
title: "SectorOne Plugin"
description: "CLI-only SectorOne DLMM on Base — quote, swap, add/remove liquidity via local TS CLI + Base MCP send_calls."
---

# SectorOne Plugin

> [!WARNING]
> **CLI-only.** Requires shell (Cursor, Claude Code, Codex). Does not work on chat-only surfaces.

> [!IMPORTANT]
> Complete Base MCP onboarding in `SKILL.md` first. Third-party protocol — executable code lives at **https://github.com/DoctorTangle/dlmmskills**.

SectorOne is a Liquidity Book (DLMM) DEX on **Base mainnet** (`chainId` `8453`, MCP chain `"base"`). Default LB version: **v2** (Joe 2.0). Use **v22** for v2.2-factory pools. **v2.1 is not on Base.**

## Install CLI (once)

```bash
git clone https://github.com/DoctorTangle/dlmmskills.git
cd dlmmskills
cp .env.example .env
export BASE_RPC_URL="<reliable Base RPC>"
npm install
npm run sectorone -- --help
```

## Orchestration

1. `get_wallets` when a write flow needs `--wallet`.
2. `npm run sectorone -- <command> --json` (stdout = JSON only).
3. `send_calls({ chain: "base", calls: [...] })` — preserve order (approvals first).
4. User approves in Base Account; poll `get_request_status` after they act.

## Commands

| Command | Purpose |
| --- | --- |
| `list-pairs` | Discover pools |
| `read-pool` | Active bin + reserves |
| `quote` | Swap quote |
| `build-swap` | Swap calldata (+ approval if needed) |
| `build-add-liquidity` | Add LP calldata |
| `build-remove-liquidity` | Remove LP from bins (`--remove-all`, `--fraction`, or `--amounts`) |
| `read-position` | LP exposure per bin |
| `normalize-calls` | Legacy tx → MCP shape (**strict by default**) |

## Remove liquidity (close bins)

```bash
npm run sectorone -- read-position --wallet "$WALLET" --pair 0xLbPair --bin-ids 1,2,3 \
  --token-x ... --token-y ... --token-x-decimals 6 --token-y-decimals 18 --json

npm run sectorone -- build-remove-liquidity \
  --wallet "$WALLET" \
  --token-x ... --token-y ... --token-x-decimals 6 --token-y-decimals 18 \
  --bin-step 25 --bin-ids 1,2,3 --remove-all --json
```

Use `--remove-all` only after explicit user confirmation.

## Safety

- No private keys, no local signing, no `cast send`.
- `--confirm-infinite-approval` required for infinite approvals.
- TTL default 1200s, max 3600s.
- Full reference: https://github.com/DoctorTangle/dlmmskills/tree/main/skills/sectorone-dlmm
