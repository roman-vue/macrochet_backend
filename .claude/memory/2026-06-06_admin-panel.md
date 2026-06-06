---
date: 2026-06-06
files: src/routes/adminRoutes.ts, src/middlewares/sessionAuth.ts, src/views/**, src/index.ts
---

Se agregó panel de administración EJS con:
- Login por sesión (express-session). Credenciales hardcodeadas: amarcela/amarcela y admin/piji2022*
- Dashboard con conteos de productos, colores y categorías
- Crear producto (multipart, imágenes, colores, categoría con datalist)
- Registrar/eliminar colores con picker hex
- Listar categorías (derivadas de Product.distinct)

Rutas: GET/POST /login, POST /logout, GET /admin, GET/POST /admin/products/create, GET/POST /admin/colors, POST /admin/colors/:id/delete, GET /admin/categories

index.ts modificado para: agregar ejs view engine, express-session, montar adminRoutes en '/'.
