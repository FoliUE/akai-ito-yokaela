# akai-ito-yokaela

Sitio estatico para GitHub Pages.

## Estructura

- `index.html`: portada con selector grande entre presente y archivo.
- `hojas.js`: colecciones y metadata de las notas que se muestran en la portada.
- `home.js`: logica de render, tabs, busqueda y estado por defecto.
- `nueva_hoja.sh`: crea una nota nueva dentro de `new-notes/` y la registra en `hojas.js`.
- `new-notes/templates/`: ejemplos de referencia para notas nuevas sin spoiler.

## Flujo recomendado

1. Ejecutar `./nueva_hoja.sh`.
2. Completar el contenido de `new-notes/XX/index.html`.
3. Ajustar en `hojas.js` el titulo o subtitulo generado si queres un texto mas personalizado.
