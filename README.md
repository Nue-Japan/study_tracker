# Study Tracker

Automated study-log tracker powered by Markdown + GitHub Actions + GitHub Pages.

## Structure

```text
.
├── .github/workflows/deploy.yml
├── docs/
│   ├── app.js
│   ├── data/
│   │   └── data.json
│   ├── index.html
│   └── styles.css
├── logs/
│   ├── TEMPLATE.md
│   └── 2026-02-18.md
└── scripts/
    └── generate-data.js
```

## Markdown Frontmatter Standard

Each study log must start with frontmatter:

```md
---
date: 2026-02-18
duration_minutes: 90
subject: Algorithms
tags: [leetcode, graph]
---

Solved BFS and shortest path problems.
Reviewed queue-based traversal patterns.
```

Required fields:
- `date`: `YYYY-MM-DD`
- `duration_minutes`: integer (`> 0`)
- `subject`: string

Optional fields:
- `tags`: array (e.g. `[tag1, tag2]`)

## Local generation

```bash
node scripts/generate-data.js
```

This parses `logs/**/*.md` and writes `docs/data/data.json`.

## Deployment

`deploy.yml` runs on push to `main`/`master`:
1. Parse logs and generate JSON
2. Publish `docs/` to GitHub Pages

After first push, enable Pages in repository settings with:
- Source: `GitHub Actions`
