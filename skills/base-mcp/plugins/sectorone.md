---
title: "SectorOne Plugin"
description: "Skill plugin reference for reading SectorOne DLMM pools and building unsigned swap and liquidity calldata through Base MCP send_calls."
---

# SectorOne Plugin

> [!IMPORTANT]
> Complete the short Base MCP onboarding flow defined in [`../SKILL.md`](../SKILL.md) before calling any SectorOne flow.

> [!WARNING]
> This plugin builds unsigned SectorOne calldata with a local TypeScript CLI, then submits unsigned calls through Base MCP `send_calls`.
> It only works in environments with shell/terminal access such as Cursor, Claude Code, Codex, or similar CLI-enabled environments.
> It does not work on chat-only surfaces that cannot run commands.

SectorOne is a Liquidity Book (DLMM) DEX on **Base mainnet only**. This plugin uses `@sectorone/sdk-v2` through a local CLI in this repository. The CLI never signs and never broadcasts. Base MCP handles wallet onboarding and user approval in Base Account.

**Chain:** Base mainnet (`chainId` `8453`, Base MCP chain string `"base"`).

See also: [sectorone-safety.md](../references/sectorone-safety.md), [sectorone-addresses.md](../references/sectorone-addresses.md), [sectorone-examples.md](../references/sectorone-examples.md).

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

Contract addresses are exported from `@sectorone/sdk-v2` (source of truth). Reference table: [sectorone-addresses.md](../references/sectorone-addresses.md).

---

## CLI Runner

From the `sectorone-base-mcp-skill` package root:

```bash
export BASE_RPC_URL="${BASE_RPC_URL:-https://base-rpc.publicnode.com}"
pnpm install
pnpm sectorone --help
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
pnpm sectorone normalize-calls --json < unsigned.json
```

Then call Base MCP `send_calls` with the normalized payload. Preserve call order (approvals before router).

---

## Orchestration

1. Complete Base MCP onboarding (`SKILL.md`).
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
pnpm sectorone list-pairs \
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
pnpm sectorone read-pool \
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
pnpm sectorone read-bin-price --bin-id 8388608 --bin-step 25 --json
pnpm sectorone read-bin-price --price 1.05 --bin-step 25 --json
```

---

## Quote Exact Input

```bash
pnpm sectorone quote \
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
pnpm sectorone build-swap \
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

## Build Add Liquidity

```bash
pnpm sectorone build-add-liquidity \
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

## Read LP Exposure

```bash
pnpm sectorone read-position \
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
- Native swaps set router `value` on the swap call; no ERC-20 approval for native input.
- Add liquidity: `--native-x` or `--native-y` when depositing native ETH on the WETH side (`addLiquidityNATIVE`).

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
- Show my SectorOne LP exposure for these bin IDs.
