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
- `construir_ejecutable.sh`: build local del paquete/app en macOS/Linux.
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

## Dependencias Previas

La app usa Python, Pillow, PyInstaller y pywebview. Para que en macOS se vea y se comporte igual que en Windows, hay que instalar también los paquetes de PyObjC que usa pywebview sobre Cocoa/WebKit.

### Windows

Desde la raíz del repo:

```powershell
py -3 -m venv .venv-notes
.venv-notes\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install pillow pyinstaller pywebview
```

### macOS Apple Silicon M2

1. Verificá que la terminal y Python estén corriendo en `arm64`:

```bash
python3 -c "import platform; print(platform.machine())"
```

2. Si necesitás compilación local de alguna dependencia, instalá las Command Line Tools:

```bash
xcode-select --install
```

3. Creá el entorno e instalá todo:

```bash
python3 -m venv .venv-notes
source .venv-notes/bin/activate
python -m pip install --upgrade pip
python -m pip install pillow pyinstaller pywebview pyobjc-core pyobjc-framework-Cocoa pyobjc-framework-Quartz pyobjc-framework-WebKit pyobjc-framework-Security
```

## Uso Diario

### Windows

```powershell
.venv-notes\Scripts\Activate.ps1
tools\notes-manager\nueva_hoja.bat
```

### macOS

```bash
source .venv-notes/bin/activate
./tools/notes-manager/nueva_hoja.sh
```

O con doble click:

- `tools/notes-manager/nueva_hoja.command`

## Compilar Localmente

### Windows

```powershell
.venv-notes\Scripts\Activate.ps1
tools\notes-manager\construir_ejecutable.bat
```

Salida esperada:

- `tools/notes-manager/dist/nueva_hoja.exe`

### macOS Apple Silicon M2

```bash
source .venv-notes/bin/activate
./tools/notes-manager/construir_ejecutable.sh
```

Salida esperada:

- `tools/notes-manager/dist/nueva_hoja/`
- `tools/notes-manager/dist/nueva_hoja/nueva_hoja`
- `tools/notes-manager/dist/nueva_hoja.app`

Notas importantes para tu caso:

- compilá siempre desde la propia Mac M2;
- usá un Python nativo `arm64`, no uno abierto bajo Rosetta;
- mantené el ejecutable o la app dentro de este repo, porque el editor lee los archivos reales del proyecto (`hojas.js`, `new-notes/`, `old-notes/`, `assets/`);
- si te fallara el arranque del `.app`, probá primero el ejecutable de terminal `tools/notes-manager/dist/nueva_hoja/nueva_hoja`.
