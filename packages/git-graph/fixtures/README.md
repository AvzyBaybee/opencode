# Performance fixtures

Generate synthetic graphs for stress checks without mutating real repositories.

```powershell
cd packages/git-graph
bun run fixtures/generate-perf.ts
```

This writes JSON snapshots under `fixtures/perf/` for:

- linear history
- many parallel branches
- dense merges
- 100k commits (optional; controlled by env)

Measure manually by loading `fixture:perf-linear` style names once wired, or by importing the JSON into layout benchmarks.

Environment:

| Variable | Default | Meaning |
|---|---|---|
| `GIT_GRAPH_PERF_COMMITS` | `10000` | Commit count for large fixture |
| `GIT_GRAPH_PERF_HUGE` | unset | Set to `1` to also emit 100000-commit fixture |
