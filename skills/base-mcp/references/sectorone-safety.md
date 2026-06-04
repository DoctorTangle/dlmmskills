# SectorOne Safety Reference

## Scope

- **Base mainnet only** (chainId `8453`, Base MCP `chain: "base"`).
- Unsigned calldata only — no private keys, no local signing, no direct RPC broadcast.

## Transaction Flow

1. CLI builds unsigned `calls` (`to`, `data`, `value` as hex).
2. Agent submits via Base MCP `send_calls`.
3. User approves in **Base Account**.

Never use `walletClient.writeContract`, `cast send`, browser wallet signers, or seed phrases.

## Approvals

- **Swap:** ERC-20 `tokenIn` approval to the LB router when allowance is insufficient (exact amount by default).
- **Add liquidity:** Approvals for each ERC-20 leg before the router call.
- **Native ETH:** No ERC-20 approval; router `value` carries the native deposit.

## Slippage (basis points)

| Bps | % | Guidance |
| --- | --- | --- |
| `<= 100` | `<= 1%` | Normal — proceed. |
| `101–500` | `1–5%` | Elevated — warn and require explicit confirmation. |
| `501–2000` | `5–20%` | High — strong warning and explicit confirmation. |
| `> 2000` | `> 20%` | Very high — do not proceed unless the user re-confirms the exact bps. |

Default CLI slippage: **50 bps** (0.5%).

## Deadlines

- Default swap/LP TTL: **1200 seconds** (20 minutes).
- Rebuild calldata if the user waits past the deadline.

## Protocol Versions

- **LB v2.0 (Joe 2.0)** (`--lb-version v2`) is the default on Base where most liquidity lives.
- **LB v2.2** (`--lb-version v22`) for newer bin-step pools on the v2.2 factory.
- Swap/build commands pick the **router + ABI matching the quoted route** (v2.0 router vs v2.2 router).
- **v2.1 is not deployed on Base** — do not use `v21`.

## RPC

- Set `BASE_RPC_URL` to a reliable endpoint before quotes or allowance reads.
- Public RPCs may return incomplete routes or rate-limit.

## Liquidity Risks

- DLMM liquidity is **bin-local** — wrong bin range or wide SPOT distribution can leave capital idle or exposed.
- Review `activeId`, `binStep`, and distribution before `build-add-liquidity`.
- Price impact on swaps can be large in thin bins.

## MEV / Execution

- Large trades in volatile pools may be sandwiched.
- Prefer conservative slippage and clear user confirmation on high-impact quotes.

## User Approval

The user must explicitly approve each batch in Base Account. The agent must not auto-submit after building calldata without showing summary and slippage warnings.
