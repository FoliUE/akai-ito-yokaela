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

## Preparación Del Entorno

Para que el editor funcione igual de bien en Windows y en tu Mac M2, conviene usar un entorno virtual dentro del repo y dejar instalado el stack del editor visual.

### Windows

```powershell
cd A:\FoliUE\akai-ito-yokaela
py -3 -m venv .venv-notes
.venv-notes\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install pillow pyinstaller pywebview
```

### macOS Apple Silicon

Usá una terminal nativa de Apple Silicon y comprobá que Python esté corriendo en `arm64`:

```bash
cd /ruta/a/FoliUE/akai-ito-yokaela
python3 -c "import platform; print(platform.machine())"
```

Si no devuelve `arm64`, no compiles todavía: primero abrí una terminal nativa y usá un Python arm64.

Después instalá el entorno:

```bash
cd /ruta/a/FoliUE/akai-ito-yokaela
python3 -m venv .venv-notes
source .venv-notes/bin/activate
python -m pip install --upgrade pip
python -m pip install pillow pyinstaller pywebview pyobjc-core pyobjc-framework-Cocoa pyobjc-framework-Quartz pyobjc-framework-WebKit pyobjc-framework-Security
```

Si alguna dependencia necesitara compilarse en vez de bajar wheel, instalá antes las Command Line Tools:

```bash
xcode-select --install
```

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
- macOS Apple Silicon: desde una Mac M2, correr `./tools/notes-manager/construir_ejecutable.sh` genera `tools/notes-manager/dist/nueva_hoja/` y también `tools/notes-manager/dist/nueva_hoja.app`.
- El build se hace con Python a traves de `tools/notes-manager/note_manager.py build` y usa PyInstaller + pywebview.
- En macOS, el ejecutable de terminal queda en `tools/notes-manager/dist/nueva_hoja/nueva_hoja`.
- En ambos casos el binario se usa dentro de este mismo repo. No conviene moverlo afuera, porque el editor necesita encontrar `hojas.js`, `new-notes/`, `old-notes/` y `assets/` alrededor del proyecto.
