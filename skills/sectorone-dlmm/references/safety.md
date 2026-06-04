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
- **Native ETH:** No ERC-20 approval; router `value` carries the native deposit. `--native-in`/`--native-out`/`--native-x`/`--native-y` require the relevant token to be WETH (`0x4200...0006`) or the command errors.
- **Infinite approval:** `--infinite-approval` (or `--infinite` for `check-approval`) grants an unlimited allowance and requires an explicit second confirmation `--confirm-infinite-approval`. Build summaries expose `approvalType: "infinite" | "exact"`.

## Slippage (basis points)

| Bps | % | Guidance |
| --- | --- | --- |
| `<= 100` | `<= 1%` | Normal — proceed. |
| `101–500` | `1–5%` | Elevated — warn and require explicit confirmation. |
| `501–2000` | `5–20%` | High — strong warning and explicit confirmation. |
| `> 2000` | `> 20%` | Very high — `build-swap` / `build-add-liquidity` **refuse to emit calldata** unless `--confirm-high-slippage` is passed after explicit user re-confirmation. |

Default CLI slippage: **50 bps** (0.5%).

## Deadlines

- Default swap/LP TTL: **1200 seconds** (20 minutes); hard maximum **3600 seconds** (1 hour) to limit MEV/execution risk from stale deadlines.
- Rebuild calldata if the user waits past the deadline.

## normalize-calls

- Converts legacy unsigned txs to the `send_calls` shape. It prints a per-call risk summary (target, selector, value, known/unknown) to stderr.
- Strict mode is **on by default**: any call that is neither an ERC-20 `approve` nor targeted at a known SectorOne contract (v2/v22 router, Liquidity Helper) is rejected. Pass `--allow-unknown-targets` only to opt out for trusted input (not recommended).

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
