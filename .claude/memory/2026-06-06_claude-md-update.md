---
date: 2026-06-06
file: CLAUDE.md
---

Added missing `/api/categories` endpoint section under API Endpoints.
The endpoint was already implemented (`src/controllers/categoryController.ts`, `src/routes/categories.ts`, mounted in `src/index.ts`) but not documented.
It returns `Product.distinct('category')` sorted alphabetically — there is no Category model.
