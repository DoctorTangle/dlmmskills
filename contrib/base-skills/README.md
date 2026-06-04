# Contrib: `base/skills` plugin stub

Copy `plugins/sectorone.md` into a fork of [base/skills](https://github.com/base/skills) at:

`skills/base-mcp/plugins/sectorone.md`

Then add a row to `skills/base-mcp/SKILL.md` plugin table:

```markdown
| SectorOne (CLI-only) | [plugins/sectorone.md](plugins/sectorone.md) |
```

**Note:** Base currently limits external contributions ([CONTRIBUTING.md](https://github.com/base/skills/blob/master/CONTRIBUTING.md)). Open an issue with Base / SectorOne before submitting the PR.

Executable CLI and full skill live in this repo:

- https://github.com/DoctorTangle/dlmmskills
- Install: `npx skills add DoctorTangle/dlmmskills --skill sectorone-dlmm`
