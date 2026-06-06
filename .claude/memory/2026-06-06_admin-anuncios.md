---
date: 2026-06-06
files: src/routes/adminRoutes.ts, src/views/admin/announcements/index.ejs, src/views/partials/nav.ejs
---

Se agregó gestión de anuncios al panel admin:
- GET /admin/announcements — lista todos los anuncios con formulario inline de creación
- GET /admin/announcements/:id/edit — carga el formulario con datos del anuncio a editar
- POST /admin/announcements — crear anuncio
- POST /admin/announcements/:id — actualizar anuncio
- POST /admin/announcements/:id/toggle — alternar status activo/inactivo
- POST /admin/announcements/:id/delete — eliminar anuncio
