# Notes Manager

Herramienta visual para crear y completar notas sin tocar HTML.

Archivos principales:

- `note_manager.py`: entrypoint en Python. Abre la app visual por defecto.
- `notes_core.py`: lógica compartida de carga, guardado, autores y bloques.
- `visual_app.py`: servidor local y ventana embebida del editor.
- `ui/editor.html`, `ui/editor.css`, `ui/editor.js`: interfaz del editor.
- `nueva_hoja.bat`: lanzador para Windows.
- `nueva_hoja.sh`: lanzador para terminales Unix/macOS.
- `nueva_hoja.command`: lanzador para macOS con doble click.
- `construir_ejecutable.bat`: build local del `.exe` en Windows.
- `construir_ejecutable.sh`: build local del binario en macOS/Linux.
- `dist/`: salida del ejecutable generado.
- `build/`: archivos temporales de PyInstaller.

Uso rápido:

- Windows: `tools\notes-manager\nueva_hoja.bat`
- macOS: `tools/notes-manager/nueva_hoja.command`
- Terminal: `python tools/notes-manager/note_manager.py`
- Sincronizar archivo viejo: `python tools/notes-manager/note_manager.py sync-archive`
- Normalizar todas las notas: `python tools/notes-manager/note_manager.py normalize-notes`

Qué podés hacer desde la app:

- crear hojas nuevas;
- activar o desactivar bloque de Mica y Leo;
- escribir directamente en una interfaz visual;
- agregar texto, citas, canciones, diálogos, imágenes y separadores;
- usar un solo bloque de texto con doble Enter para separar párrafos;
- cambiar tamaño de letra, familia tipográfica y alineación por bloque;
- editar composiciones con PNGs sin tocar HTML cuando el patrón ya tiene equivalente visual;
- subir foto central y también imágenes dentro de bloques;
- ver el preview real de la nota mientras editás;
- guardar todo en archivos estructurados.

Comandos útiles:

- `python tools/notes-manager/note_manager.py gui`: abre el editor visual.
- `python tools/notes-manager/note_manager.py list-notes`: lista las notas nuevas disponibles.
- `python tools/notes-manager/note_manager.py sync-archive`: genera los archivos estructurados faltantes del archivo viejo.
- `python tools/notes-manager/note_manager.py sync-archive --force`: reimporta `old-notes/*` desde cada `legacy-index.html`.
- `python tools/notes-manager/note_manager.py normalize-notes`: compacta textos consecutivos y convierte bloques legacy al formato editable actual.
- `python tools/notes-manager/note_manager.py build`: construye el ejecutable visual.
