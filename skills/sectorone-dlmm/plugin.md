---
title: "SectorOne Plugin"
description: "Skill plugin reference for reading SectorOne DLMM pools and building unsigned swap and liquidity calldata through Base MCP send_calls."
---

# SectorOne Plugin

> [!IMPORTANT]
> Complete the Base MCP onboarding flow in [SKILL.md](SKILL.md) before calling any SectorOne flow.

> [!WARNING]
> This plugin builds unsigned SectorOne calldata with a local TypeScript CLI, then submits unsigned calls through Base MCP `send_calls`.
> It only works in environments with shell/terminal access such as Cursor, Claude Code, Codex, or similar CLI-enabled environments.
> It does not work on chat-only surfaces that cannot run commands.

SectorOne is a Liquidity Book (DLMM) DEX on **Base mainnet only**. This plugin uses `@sectorone/sdk-v2` through a local CLI in the [dlmmskills](https://github.com/DoctorTangle/dlmmskills) repository. The CLI never signs and never broadcasts. Base MCP handles wallet onboarding and user approval in Base Account.

**Chain:** Base mainnet (`chainId` `8453`, Base MCP chain string `"base"`).

See also: [references/safety.md](references/safety.md), [references/addresses.md](references/addresses.md), [references/examples.md](references/examples.md).

---

## Safety Boundary

- Never ask for or use a private key.
- Never sign locally.
- Never broadcast transactions directly.
- Never use `walletClient.writeContract` in the plugin flow.
- Never use `cast send`.
- Always submit through Base MCP `send_calls`.
- Let the user approve in Base Account.
- Use Base mainnet only.
- On Base, **most liquidity is still in LB v2.0 (Joe 2.0)** — use `--lb-version v2` for discovery/LP; swaps auto-target the router for the quoted route version.
- Use **v2.2** (`--lb-version v22`) only for pools deployed on the v2.2 factory.
- Do not use **v2.1** because it is not deployed on Base.

---

## Chain and Contracts

| Item | Value |
| --- | --- |
| Chain | Base mainnet |
| Chain ID | `8453` |
| Base MCP `chain` | `"base"` |
| Default LB version (CLI) | `v2` (Joe 2.0 — most Base liquidity) |
| Newer pools | `v22` via `--lb-version v22` |

Contract addresses are exported from `@sectorone/sdk-v2` (source of truth). Reference table: [references/addresses.md](references/addresses.md).

---

## CLI Runner

From the **dlmmskills** repository root (after `git clone` and `npm install`):

```bash
export BASE_RPC_URL="${BASE_RPC_URL:-https://base-rpc.publicnode.com}"
npm install
npm run sectorone -- --help
```

Use a reliable Base RPC for quotes, pool reads, and allowance checks. Public endpoints may rate-limit.

Fetch the user wallet from Base MCP `get_wallets` only when building transactions. Pass it as `--wallet`.

---

## Base MCP Conversion

Tx-building commands emit JSON with `chain: "base"` and a `calls` array:

```json
{
  "chain": "base",
  "calls": [
    { "to": "0x...", "data": "0x...", "value": "0x0" }
  ]
}
```

If you receive legacy unsigned txs with `from` and decimal `value`, normalize them:

```bash
npm run sectorone -- normalize-calls --json < unsigned.json
```

A per-call risk summary (target, selector, value, known/unknown) is printed to stderr; stdout stays pure `{ chain, calls }`. Strict mode is **on by default**: any call that is neither an ERC-20 `approve` nor aimed at a known SectorOne contract (v2/v22 router, Liquidity Helper) is rejected. Pass `--allow-unknown-targets` only to opt out for trusted input (not recommended).

Then call Base MCP `send_calls` with the normalized payload. Preserve call order (approvals before router).

---

## Orchestration

1. Complete Base MCP onboarding ([SKILL.md](SKILL.md)).
2. `get_wallets` when a write flow needs `--wallet`.
3. Set `BASE_RPC_URL`.
4. Run the SectorOne CLI with `--json` (stdout is JSON only; warnings on stderr).
5. Submit `send_calls({ chain: "base", calls: [...] })`.
6. Show the Base Account approval URL when appropriate.
7. Poll `get_request_status` after the user acts.

If the CLI exits non-zero, do not submit partial output.

---

## Pool Discovery

```bash
npm run sectorone -- list-pairs \
  --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-out 0x4200000000000000000000000000000000000006 \
  --token-in-decimals 6 \
  --token-out-decimals 18 \
  --lb-version v2 \
  --json
```

Prefer token addresses over symbols on Base.

---

## Read Active Bin and Reserves

```bash
npm run sectorone -- read-pool \
  --token-x 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-y 0x4200000000000000000000000000000000000006 \
  --token-x-decimals 6 \
  --token-y-decimals 18 \
  --bin-step 25 \
  --lb-version v2 \
  --json
```

Or pass `--pair <lbPairAddress>` with `--bin-step`.

Bin price helpers:

```bash
npm run sectorone -- read-bin-price --bin-id 8388608 --bin-step 25 --json
npm run sectorone -- read-bin-price --price 1.05 --bin-step 25 --json
```

---

## Quote Exact Input

```bash
npm run sectorone -- quote \
  --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-out 0x4200000000000000000000000000000000000006 \
  --token-in-decimals 6 \
  --token-out-decimals 18 \
  --amount-in 100 \
  --slippage-bps 50 \
  --json
```

Use `--native-in` / `--native-out` for native ETH legs. Default slippage: **50 bps** (0.5%).

---

## Build Swap

```bash
npm run sectorone -- build-swap \
  --wallet "$BASE_MCP_WALLET" \
  --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-out 0x4200000000000000000000000000000000000006 \
  --token-in-decimals 6 \
  --token-out-decimals 18 \
  --amount-in 100 \
  --slippage-bps 50 \
  --ttl 1200 \
  --json
```

Pass the JSON `calls` array to `send_calls`. Approval for ERC-20 `tokenIn` is included when needed.

---

## Build Create Pool

Deploy a **new** LB pair when `list-pairs` does not already show your token pair + `binStep`. Uses the router `createLBPair` (one call, no approvals). Tokens are sorted on-chain (token0/token1).

**Requires** `--confirm-create` after explicit user approval — deploying the wrong `activeId` / price anchor is hard to undo.

**Initial price anchor** — provide **at most one** of:

| Flag | Meaning |
| --- | --- |
| `--price-token-y-per-token-x <n>` | Your CLI `--token-y` per `--token-x` (converted to sorted token1/token0 for bin math) |
| `--price-sorted-y-per-sorted-x <n>` | On-chain **token1 per token0**; **requires** `--token-x` = lower-address token (token0) |
| `--active-id <n>` | Explicit uint24 bin id (sorted pair semantics) |
| *(none)* | Defaults to `8388608` (neutral LB anchor) |

**Do not use bare `--price`** — it was removed as ambiguous.

On Base, **WETH sorts before USDC** (token0=WETH, token1=USDC). “~3000 USDC per 1 WETH” ⇒ **sorted** Y/X = `3000` (USDC per WETH). Use sorted flags only when `--token-x` is WETH:

```bash
npm run sectorone -- build-create-pool \
  --token-x 0x4200000000000000000000000000000000000006 \
  --token-y 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-x-decimals 18 \
  --token-y-decimals 6 \
  --bin-step 25 \
  --price-sorted-y-per-sorted-x 3000 \
  --lb-version v2 \
  --confirm-create \
  --json
```

If you prefer `--token-x` USDC first, use `--price-token-y-per-token-x 0.000333` (WETH per USDC) instead.

JSON `summary` includes `inputTokenX`, `sortedTokenX`, `inputOrderWasSorted`, `priceSemantic`, and `impliedSortedYPerSortedX` — review these before `send_calls`.

Preflight checks: pair must not exist, `bin-step` must have an open factory preset (`creationUnlocked` on v2.0).

After the tx confirms, use `list-pairs` / `read-pool`, then `build-add-liquidity` for the first LP deposit.

---

## Build Add Liquidity

```bash
npm run sectorone -- build-add-liquidity \
  --wallet "$BASE_MCP_WALLET" \
  --token-x 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-y 0x4200000000000000000000000000000000000006 \
  --token-x-decimals 6 \
  --token-y-decimals 18 \
  --amount-x 100 \
  --amount-y 0.05 \
  --bin-step 25 \
  --distribution SPOT \
  --amount-slippage-bps 50 \
  --price-slippage-bps 50 \
  --json
```

MVP distribution: `SPOT`. Approvals for ERC-20 legs precede the router call.

---

## Build Remove Liquidity

Close or reduce LP in specific bins. Use `read-position` first to discover bin IDs and sizes.

**How much to remove** — specify exactly one of:

| Flag | Meaning |
| --- | --- |
| `--remove-all` | Burn 100% of your LP shares in each listed bin |
| `--fraction <n>` | Remove a fraction per bin (`0 < n <= 1`, e.g. `0.5` = 50%) |
| `--amounts <list>` | Explicit LP share amounts per bin (comma-separated, same order as `--bin-ids`) |

```bash
npm run sectorone -- build-remove-liquidity \
  --wallet "$BASE_MCP_WALLET" \
  --token-x 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-y 0x4200000000000000000000000000000000000006 \
  --token-x-decimals 6 \
  --token-y-decimals 18 \
  --bin-step 25 \
  --bin-ids 8376297,8376298,8376299 \
  --remove-all \
  --amount-slippage-bps 50 \
  --ttl 1200 \
  --json
```

Optional: `--pair <lbPairAddress>` if you already know the pool address. Use `--native-x` / `--native-y` to receive **native ETH** when the WETH side is withdrawn (`removeLiquidityNATIVE` / `removeLiquidityAVAX`).

No ERC-20 approvals are needed for remove — the router burns your bin LP shares in one call.

---

## Read LP Exposure

```bash
npm run sectorone -- read-position \
  --wallet "$BASE_MCP_WALLET" \
  --pair 0xLbPairAddress \
  --bin-ids 8376297,8376298,8376299 \
  --token-x 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-y 0x4200000000000000000000000000000000000006 \
  --token-x-decimals 6 \
  --token-y-decimals 18 \
  --json
```

---

## Slippage Warnings

| Tolerance | Level | Action |
| --- | --- | --- |
| `<= 1%` | Normal | Proceed. |
| `> 1%` and `<= 5%` | Elevated | Warn and confirm. |
| `> 5%` and `<= 20%` | High | Strong warning; explicit confirmation. |
| `> 20%` | Very high | Do not submit without re-confirming the exact bps. |

---

## Native ETH Handling

- Swaps: `--native-in` / `--native-out` on `quote` and `build-swap`.
- WETH on Base: `0x4200000000000000000000000000000000000006`.
- Native flags require the corresponding token to be WETH; otherwise the command errors (`INVALID_NATIVE_SIDE`/`INVALID_NATIVE_IN`).
- Native swaps set router `value` on the swap call; no ERC-20 approval for native input.
- Add liquidity: `--native-x` or `--native-y` when depositing native ETH on the WETH side (`addLiquidityNATIVE`).

## Approvals

- Exact approval is the default. `--infinite-approval` (swap/LP) and `--infinite` (`check-approval`) require a second `--confirm-infinite-approval`; build summaries expose `approvalType`.
- TTL default 1200s, hard max 3600s.

---

## Token Address Notes

| Token | Address |
| --- | --- |
| WETH | `0x4200000000000000000000000000000000000006` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Always pass decimals explicitly. Do not guess symbols on Base.

---

## Troubleshooting

| Issue | Action |
| --- | --- |
| `BASE_RPC_URL is required` | Export `BASE_RPC_URL`. |
| `No SectorOne DLMM route found` | Run `list-pairs`; verify liquidity and bin steps. |
| `PAIR_ALREADY_EXISTS` | Pool exists; use `build-add-liquidity` instead of `build-create-pool`. |
| `CONFIRM_CREATE_REQUIRED` | Pass `--confirm-create` only after user approval. |
| `PRICE_REQUIRES_SORTED_INPUT_ORDER` | Reorder tokens so `--token-x` is token0, or use `--price-token-y-per-token-x`. |
| `CREATE_PRICE_MODE_REQUIRED` | Use only one price/active-id mode. |
| `BIN_STEP_NO_PRESET` / `CREATION_LOCKED` | Pick another `--bin-step` or `--lb-version v22`. |
| `LB v2.1 is not deployed` | Use `--version v22`. |
| Rate limits / timeouts | Use a dedicated Base RPC. |
| JSON parse errors from agent | Use `--json`; capture stdout only. |

---

## Example Prompts

- Find SectorOne WETH/USDC DLMM pools on Base.
- Quote 100 USDC to WETH on SectorOne with 0.5% slippage.
- Prepare a SectorOne swap of 100 USDC to WETH for my Base MCP wallet.
- Show the active bin for the USDC/WETH 25 bps pool.
- Build add-liquidity calldata for USDC/WETH around the active bin.
- Create a new USDC/WETH 25 bps SectorOne pool at price 3000 (with confirmation).
- Remove all my liquidity from these bin IDs on SectorOne.
- Show my SectorOne LP exposure for these bin IDs.
