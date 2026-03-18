# akai-ito-yokaela

Sitio estatico para GitHub Pages.

## Estructura

- `index.html`: portada con selector grande entre presente y archivo.
- `hojas.js`: colecciones y metadata de las notas que se muestran en la portada.
- `home.js`: logica de render, tabs, busqueda y estado por defecto.
- `note-page.js`: renderer generico reutilizable para notas basadas en contenido y para el preview del editor.
- `tools/notes-manager/`: carpeta del editor visual en Python, el build y los launchers.
- `new-notes/XX/note.json`: metadata de cada hoja nueva.
- `new-notes/XX/mica.note.json` y `new-notes/XX/leo.note.json`: contenido estructurado por autor.
- `new-notes/XX/*.note`: formato legacy todavia soportado para notas que existían antes.
- `new-notes/FORMATOS.md`: sintaxis legacy, útil si alguna vez querés editar a mano.
- `new-notes/templates/`: referencias HTML viejas, utiles solo como inspiracion visual.

## Tooling

- Windows: `tools\notes-manager\nueva_hoja.bat`
- macOS con doble click: `tools/notes-manager/nueva_hoja.command`
- Terminal: `python tools/notes-manager/note_manager.py`
- Sincronizar archivo legacy: `python tools/notes-manager/note_manager.py sync-archive`
- Normalizar bloques y conversiones: `python tools/notes-manager/note_manager.py normalize-notes`
- Documentacion del gestor: `tools/notes-manager/README.md`

## Flujo recomendado

1. Abrir `tools/notes-manager/nueva_hoja.bat` en Windows o `tools/notes-manager/nueva_hoja.command` / `tools/notes-manager/nueva_hoja.sh` en macOS.
2. Se abre el editor visual embebido.
3. Elegir o crear una hoja desde la barra lateral.
4. Editar la configuración general, la foto central y los bloques de Mica y Leo con preview en vivo.
5. Guardar cuando quieras sincronizar los cambios con los archivos del repo.

## Archivo Legacy

- `python tools/notes-manager/note_manager.py sync-archive`: materializa los `note.json`, bloques por autor y `index.html` genéricos que necesita `old-notes/`.
- `python tools/notes-manager/note_manager.py sync-archive --force`: vuelve a importar cada nota vieja desde su `legacy-index.html`.
- `python tools/notes-manager/note_manager.py normalize-notes`: recompone los documentos de autor con el formato actual, compacta textos consecutivos y convierte HTML legacy cuando ya hay una versión editable.
- El modo `--force` pisa la versión estructurada actual de cada nota vieja, así que conviene usarlo solo cuando realmente querés rehacer la importación desde el HTML legacy.

## Ejecutables

- Windows: desde este repo, correr `tools\notes-manager\construir_ejecutable.bat` genera `tools/notes-manager/dist/nueva_hoja.exe`.
- macOS Apple Silicon: desde una Mac M2, correr `./tools/notes-manager/construir_ejecutable.sh` genera `tools/notes-manager/dist/nueva_hoja` nativo para esa maquina.
- El build se hace con Python a traves de `tools/notes-manager/note_manager.py build` y usa PyInstaller + pywebview.
