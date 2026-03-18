from __future__ import annotations

import argparse
import sys

from notes_core import (
    FAVICON_FILE,
    ROOT,
    TOOL_HOME,
    configure_stdio,
    list_notes,
    normalize_all_notes,
    pad,
    sync_legacy_archive,
)
from visual_app import launch_visual_editor


configure_stdio()


def print_header(title: str) -> None:
    print()
    print("=" * len(title))
    print(title)
    print("=" * len(title))
    print()


def show_notes_catalog() -> None:
    notes = list_notes()
    print_header("Notas nuevas disponibles")

    if not notes:
        print("Todavía no hay notas nuevas cargadas.")
        print()
        return

    for note in notes:
        number = pad(int(note["numero"]))
        title = note.get("titulo", f"Nueva nota {number}")
        authors = ", ".join(author["id"].capitalize() for author in note.get("authors", []))
        print(f"{number} - {title} [{authors}]")

    print()


def build_executable() -> int:
    print_header("Construir ejecutable visual")
    print(f"Carpeta detectada del proyecto: {ROOT}")
    print()

    try:
        import PyInstaller.__main__ as pyinstaller_main
    except ImportError:
        print("No encontré PyInstaller instalado.")
        print("Instalalo con:")
        print("  python -m pip install pyinstaller pywebview")
        print()
        print("Después corré de nuevo:")
        print("  python tools/notes-manager/note_manager.py build")
        print()
        return 1

    dist_dir = TOOL_HOME / "dist"
    work_dir = TOOL_HOME / "build" / "pyinstaller"
    work_dir.mkdir(parents=True, exist_ok=True)

    pyinstaller_args = [
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        "--name",
        "nueva_hoja",
        "--distpath",
        str(dist_dir),
        "--workpath",
        str(work_dir / "work"),
        "--specpath",
        str(work_dir / "spec"),
        "--collect-all",
        "webview",
        str(TOOL_HOME / "note_manager.py"),
    ]

    if FAVICON_FILE.exists():
        pyinstaller_args[0:0] = ["--icon", str(FAVICON_FILE)]

    pyinstaller_main.run(pyinstaller_args)

    executable_name = "nueva_hoja.exe" if sys.platform.startswith("win") else "nueva_hoja"

    print()
    print(f"Listo. Ejecutable generado en: {(dist_dir / executable_name).relative_to(ROOT)}")
    if FAVICON_FILE.exists():
        print(f"Icono aplicado desde: {FAVICON_FILE.relative_to(ROOT)}")
    print("En Mac M2 tenés que correr este mismo comando desde una Mac para obtener el binario nativo.")
    print()
    return 0


def sync_archive(force: bool = False) -> int:
    print_header("Sincronizar archivo legacy")
    print(f"Carpeta detectada del proyecto: {ROOT}")
    print()

    try:
        stats = sync_legacy_archive(overwrite=force)
    except FileNotFoundError as exc:
        print(exc)
        print()
        return 1

    action_label = "reimportadas desde legacy-index.html" if force else "sincronizadas"
    print(f"Notas viejas {action_label}: {stats['processed']}")
    print(f"  - Nuevas generadas: {stats['created']}")
    print(f"  - Actualizadas: {stats['updated']}")
    print(f"  - Ya existentes: {stats['existing']}")
    print()

    if force:
        print("Se volvió a leer el HTML legacy y se regeneraron note.json y los bloques estructurados.")
    else:
        print("Se materializaron las notas faltantes y se reescribieron los index.html genéricos.")
    print()
    return 0


def normalize_notes() -> int:
    print_header("Normalizar notas")
    print(f"Carpeta detectada del proyecto: {ROOT}")
    print()

    stats = normalize_all_notes()

    print(f"Notas procesadas: {stats['processed']}")
    print(f"  - Nuevas: {stats['nuevas']}")
    print(f"  - Viejas: {stats['viejas']}")
    print()
    print("Se reescribieron note.json y documentos de autor usando el formato estructurado actual.")
    print("Esto compacta textos consecutivos y convierte HTML legacy cuando ya existe un equivalente editable.")
    print()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Editor visual para crear y completar notas sin tocar HTML."
    )
    subparsers = parser.add_subparsers(dest="command")

    gui_parser = subparsers.add_parser("gui", help="Abre la interfaz visual embebida")
    gui_parser.set_defaults(handler=lambda _args: launch_visual_editor())

    list_parser = subparsers.add_parser("list-notes", help="Lista las notas nuevas disponibles")
    list_parser.set_defaults(handler=lambda _args: show_notes_catalog())

    sync_parser = subparsers.add_parser(
        "sync-archive",
        help="Materializa o reimporta las notas viejas desde old-notes/",
    )
    sync_parser.add_argument(
        "--force",
        action="store_true",
        help="Regenera note.json y bloques desde legacy-index.html para cada nota vieja.",
    )
    sync_parser.set_defaults(handler=lambda args: sync_archive(force=bool(args.force)))

    normalize_parser = subparsers.add_parser(
        "normalize-notes",
        help="Reescribe old-notes y new-notes con el formato estructurado actual.",
    )
    normalize_parser.set_defaults(handler=lambda _args: normalize_notes())

    build_parser_cmd = subparsers.add_parser("build", help="Construye el ejecutable visual con PyInstaller")
    build_parser_cmd.set_defaults(handler=lambda _args: build_executable())

    return parser


def main() -> int:
    parser = build_parser()

    if len(sys.argv) == 1:
        return launch_visual_editor()

    args = parser.parse_args()

    if not hasattr(args, "handler"):
        parser.print_help()
        return 1

    result = args.handler(args)
    return int(result) if isinstance(result, int) else 0


if __name__ == "__main__":
    raise SystemExit(main())
