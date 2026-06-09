# Agent friction — improvement plan (implemented)

| Priority | Item | Status |
| --- | --- | --- |
| P0 | ERC-1155 approve in remove + doc fix | Done |
| P0 | `--bin-count` for CURVE/BID_ASK | Done |
| P0 | `--native-x` guard on Base v2 | Done |
| P0 | `discover-lp-bins` | Done |
| P0 | Rebalance playbook in skills | Done |
| P1 | `--batch-size` on remove | Done |
| P1 | `build-rebalance-liquidity` | Done |
| P1 | Local `position:execute` / `position:rebalance` | Done |
| P1 | Add summary metadata (`needsWethWrap`, etc.) | Done |
| P2 | SDK `supportsNativeLiquidity` | Future |

## Verification

```bash
export BASE_RPC_URL=https://base-rpc.publicnode.com
npm run sectorone -- discover-lp-bins --wallet 0x… --pair 0x81c74e5b255da07af7697792d4b07532940df870 --json
npm run test
```

## Repos

- **CLI:** [DoctorTangle/dlmmskills](https://github.com/DoctorTangle/dlmmskills)
- **Skills:** [DoctorTangle/Sectoroneskills](https://github.com/DoctorTangle/Sectoroneskills)
