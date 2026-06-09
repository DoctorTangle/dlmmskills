# P2 — upstream SDK (`@sectorone/sdk-v2`)

The following live in **dlmmskills** as CLI shims until contributed to [DoctorTangle/SectorOne](https://github.com/DoctorTangle/SectorOne):

| API | CLI location | Proposed SDK path |
| --- | --- | --- |
| `supportsNativeLiquidity(chainId, version)` | `src/lib/native-liquidity.ts` | `packages/v2/src/utils/nativeLiquidity.ts` |
| `MAX_BINS_PER_TX` / `SUGGESTED_REMOVE_BATCH_SIZE` | `src/lib/bin-range.ts` + re-export in `native-liquidity.ts` | `packages/v2/src/constants.ts` or utils |

## Suggested upstream implementation

```typescript
// packages/v2/src/utils/nativeLiquidity.ts
import { ChainId } from '@sectorone/sdk-core'

export const MAX_BINS_PER_TX = 15
export const SUGGESTED_REMOVE_BATCH_SIZE = 10

export function supportsNativeLiquidity(
  chainId: number,
  lbVersion: 'v2' | 'v22'
): boolean {
  if (chainId !== ChainId.BASE) return false
  return lbVersion === 'v22'
}
```

Export from `packages/v2/src/utils/index.ts`.

## After upstream merge

1. Bump `sectoroneSdkCommit` in dlmmskills `package.json`.
2. Replace CLI shim imports with `@sectorone/sdk-v2`.
3. Keep tests in dlmmskills pointing at SDK exports.
