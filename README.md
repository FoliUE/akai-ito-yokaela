# akai-ito-yokaela

Sitio estatico para GitHub Pages.

## Estructura

- `index.html`: portada con selector grande entre presente y archivo.
- `hojas.js`: colecciones y metadata de las notas que se muestran en la portada.
- `home.js`: logica de render, tabs, busqueda y estado por defecto.
- `note-page.js`: renderer generico para las notas nuevas basadas en contenido.
- `tools/notes-manager/`: carpeta de tooling para crear hojas, completar bloques y construir ejecutables sin ensuciar la raiz.
- `new-notes/XX/note.json`: metadata de cada hoja nueva.
- `new-notes/XX/mica.note` y `new-notes/XX/leo.note`: contenido separado por autor.
- `new-notes/FORMATOS.md`: sintaxis para citas, canciones, dialogos e imagenes inline.
- `new-notes/templates/`: referencias HTML viejas, utiles solo como inspiracion visual.

## Tooling

- Windows: `tools\notes-manager\nueva_hoja.bat`
- macOS con doble click: `tools/notes-manager/nueva_hoja.command`
- Terminal: `python tools/notes-manager/note_manager.py`
- Documentacion del gestor: `tools/notes-manager/README.md`

## Flujo recomendado

1. Abrir `tools/notes-manager/nueva_hoja.bat` en Windows o `tools/notes-manager/nueva_hoja.command` / `tools/notes-manager/nueva_hoja.sh` en macOS.
2. Usar el menu interactivo.
3. Elegir si queres crear una hoja nueva, completar el bloque de Mica o Leo, ver la guia o ver ejemplos.
4. Si una parte falta, el gestor te deja ese bloque en placeholder hasta completarlo.
5. La foto central `assets/img/new-notes/XX.jpeg` se crea siempre: podés elegir un archivo en ese momento o dejar el JPEG vacío para reemplazarlo después.

## Ejecutables

- Windows: desde este repo, correr `tools\notes-manager\construir_ejecutable.bat` genera `tools/notes-manager/dist/nueva_hoja.exe`.
- macOS Apple Silicon: desde una Mac M2, correr `./tools/notes-manager/construir_ejecutable.sh` genera `tools/notes-manager/dist/nueva_hoja` nativo para esa maquina.
- El build se hace con Python a traves de `tools/notes-manager/note_manager.py build` y usa PyInstaller si esta instalado.
