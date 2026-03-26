# Wallpaper Group Viewer

A lightweight React + Vite web application for visualizing the 17 wallpaper groups (plane symmetry groups).  Main live at https://main--yetanotherwallpaperviewer.netlify.app/

## Features

- **Interactive generator editor**: specify isometries (translations, rotations, reflections, glide reflections)
- **Group generation**: computes all group elements up to a configurable word length using BFS
- **Lattice validation**: detects dense otranslation sets and verifies the translation subgroup equals the specified lattice
- **SVG visualization**:
  - Rotation centres shown as polygons (◆ 2-fold, ▲ 3-fold, ■ 4-fold, ⬡ 6-fold)
  - Reflection axes shown as solid lines
  - Glide reflection axes shown as dotted lines
  - Lattice points shown as dots
- **17 preset wallpaper groups** (p1, p2, pm, pg, cm, pmm, pmg, pgg, cmm, p4, p4m, p4g, p3, p3m1, p31m, p6, p6m)

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` – Start development server
- `npm run build` – Build for production
- `npm test` – Run tests
- `npm run lint` – Lint with ESLint

## Deployment

Configured for [Netlify](https://www.netlify.com/) via `netlify.toml`. Push to deploy.
