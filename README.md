# Ciudad en Evidencia — Proyecto base MVP

Este proyecto es una base funcional para una app de reportes urbanos sobre mapa satelital.

## Qué incluye

- Mapa satelital con Leaflet + capa de Esri World Imagery
- Alta de reportes con:
  - título
  - categoría
  - severidad
  - estado
  - descripción
  - ubicación exacta
  - imagen opcional
- Persistencia local con `localStorage`
- Listado lateral con filtros
- Vista detalle de cada reclamo
- Botón para apoyar reclamos
- Cambio rápido de estado
- Datos demo

## Cómo usarlo

1. Descargá y descomprimí el proyecto.
2. Abrí `index.html` en tu navegador.
3. Si querés una experiencia más estable, también podés levantarlo con cualquier servidor estático.

Ejemplo con VS Code + Live Server o con Python:

```bash
python -m http.server 5500
```

Luego abrís `http://localhost:5500`.

## Próximos pasos recomendados

- Backend con Node.js + Express
- Base de datos PostgreSQL
- Autenticación real
- Panel de municipalidad con usuarios y permisos
- Subida de imágenes a Cloudinary/S3
- Notificaciones
- Comentarios por reclamo
- Sistema de validación comunitaria
- Dashboard de calor y métricas por barrio

## Estructura

- `index.html`: estructura principal
- `styles.css`: diseño visual responsive
- `app.js`: lógica completa del MVP

