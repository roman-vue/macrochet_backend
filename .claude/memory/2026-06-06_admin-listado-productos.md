---
date: 2026-06-06
files: src/routes/adminRoutes.ts, src/views/admin/products/index.ejs, src/views/partials/nav.ejs
---

Se agregó vista de listado de productos (GET /admin/products) con tabla y botón eliminar.
Se corrigió el wrapper async en todos los handlers (función `a()`) para que Express 4 propague errores al handler global.
Se cambió el link de "Productos" en el nav para apuntar a /admin/products en lugar de /admin/products/create.
