---
date: 2026-06-06
files: src/routes/adminRoutes.ts, src/views/admin/products/edit.ejs, src/views/admin/products/index.ejs
---

Se agregó edición de productos:
- GET /admin/products/:id/edit — formulario prellenado con datos actuales
- POST /admin/products/:id — guarda cambios; permite marcar imágenes existentes para eliminar (checkbox removeImages) y subir imágenes nuevas que se añaden a las que quedan
- Botón "Editar" añadido en la tabla de listado de productos
