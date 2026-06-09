# SectorOne DLMM — Agent Friction Report

**Date:** 2026-06-09  
**Context:** Live session on Base mainnet (WETH/USDC pool `0x81c74…f870`)  
**Flows:** Wallet check → SPOT deposit (50 bins) → rebalance CURVE (50) → rebalance BID_ASK (41)

## Summary

The official MCP path (unsigned CLI + Base MCP `send_calls`) works well for swaps and calldata builds. Live rebalances exposed gaps: wrong remove-approval docs, missing LP discovery, no `--bin-count` for CURVE/BID_ASK, `--native-x` broken on Base v2, and no batched remove.

**Status (2026-06):** Addressed in dlmmskills + Sectoroneskills — see [improvement-plan.md](./improvement-plan.md).

## Root causes

1. Skill described ideal MCP flow; chain reality needs ERC-1155 approve, batching, WETH wrap.
2. Undocumented local-execute path (`PRIVATE_KEY`, `position:*` scripts).
3. Agents had to guess bin IDs; SDK default is 11 bins without `--bin-count`.

## Fixes shipped

### CLI (dlmmskills)

| Item | Command / change |
| --- | --- |
| LP discovery | `discover-lp-bins` |
| ERC-1155 check | `check-lp-approval` |
| Batched remove | `build-remove-liquidity --batch-size 10` |
| Rebalance orchestration | `build-rebalance-liquidity` |
| Balances | `wallet-balances` |
| Add width | `--bin-count` for SPOT/CURVE/BID_ASK |
| Remove approve | `setApprovalForAll` in `buildRemoveLiquidityCalls` |
| Native guard | `NATIVE_LIQUIDITY_UNSUPPORTED` on v2 Base |
| Local execute | `npm run position:execute`, `position:withdraw`, `position:rebalance` |

### Skills (Sectoroneskills)

- `skills/sectorone-dlmm/references/rebalance-playbook.md`
- Corrected remove approval + native-x docs in `plugin.md` / `safety.md`
- `dlmm-integration` + `sectorone-bankr-execute` cross-links

## Reference pool

- Pair: `0x81c74e5b255da07af7697792d4b07532940df870` (WETH/USDC, bin step 10, LB v2)
- Router: `0xd4f937581650A2d6e416Dd9EF5372C1672422843`

## Ideal agent sequence (rebalance)

```text
read-pool → discover-lp-bins → check-lp-approval
→ build-remove-liquidity --batch-size 10
→ [wrap WETH if needed]
→ build-add-liquidity --distribution … --bin-count …
→ send_calls (approvals first, rebuild, then add)
→ read-position
```

Or: `build-rebalance-liquidity` → submit each step.
