#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

ROOT="."

# Buscar la carpeta numérica más alta: 01, 02, 03...
max=0
for dir in "$ROOT"/[0-9][0-9]; do
  [[ -d "$dir" ]] || continue
  base="$(basename "$dir")"
  num=$((10#$base))
  (( num > max )) && max=$num
done

next=$((max + 1))
folder="$(printf "%02d" "$next")"

mkdir -p "$ROOT/$folder"
mkdir -p "$ROOT/assets/img"
touch "$ROOT/assets/img/.gitkeep"

touch "$ROOT/assets/img/$folder.jpg"

cat > "$ROOT/$folder/index.html" <<EOF
<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hoja $folder — L&M</title>
  <link rel="icon" type="image/png" href="../favicon.png">
  <link rel="stylesheet" href="../styles.css">
</head>
<body class="theme-soft-romance">
  <main class="page-shell">
    <div class="page-topbar">
      <a class="back-link" href="../index.html">← Volver al inicio</a>
    </div>

    <header class="page-header">
      <p class="page-number">Hoja $folder</p>
      <h1>Un cruce entre tu voz y la mía</h1>
      <p class="page-description">
        Cada hoja junta dos partes de una misma historia
      </p>
    </header>

    <section class="page-media">
      <figure class="note-photo-card">
        <!-- ==================================================
             FOTO DE LA HOJA
             Guardá la imagen en: assets/img/$folder.jpg
             También podés usar .png o .webp, cambiando el src.
             ================================================== -->
        <img
          src="../assets/img/$folder.jpg"
          alt="Recuerdo de la hoja $folder"
          onerror="this.style.display='none'; this.parentElement.classList.add('is-empty');"
        >
        <div class="note-photo-placeholder">
          Agregá una foto en <strong>assets/img/$folder.jpg</strong>
        </div>
        <figcaption>
          Una imagen para acompañar esta hoja.
        </figcaption>
      </figure>
    </section>

    <section class="notes-layout">
      <article class="note-card note-card--mica">
        <span class="note-label">Mica</span>
        <h2>Tu nota</h2>
        <p class="note-helper">Acá va la transcripción de la nota de Micaela.</p>

        <div class="note-content">
          <!-- ==================================================
               EMPIEZA ACÁ LA NOTA DE MICAELA
               ================================================== -->
          <p class="note-placeholder">
            [PEGÁ ACÁ LA NOTA DE MICAELA]
          </p>

          <p>
            Podés separarla en párrafos para que respire mejor.
          </p>

          <!-- ==================================================
               TERMINA ACÁ LA NOTA DE MICAELA
               ================================================== -->
        </div>
      </article>

      <article class="note-card note-card--leo">
        <span class="note-label">Leo</span>
        <h2>Mi respuesta</h2>
        <p class="note-helper">Acá va tu respuesta a esa nota.</p>

        <div class="note-content">
          <!-- ==================================================
               EMPIEZA ACÁ TU NOTA
               ================================================== -->
          <p class="note-placeholder">
            [PEGÁ ACÁ TU RESPUESTA]
          </p>

          <p>
            También podés escribirla en varios párrafos o destacar una frase.
          </p>

          <!-- ==================================================
               TERMINA ACÁ TU NOTA
               ================================================== -->
        </div>
      </article>
    </section>

    <footer class="page-footer">
      Hecho con amor, hoja por hoja.
    </footer>
  </main>
</body>
</html>
EOF

echo "----------------------------------------"
echo "Nueva hoja creada: $folder/"
echo "Archivo: $folder/index.html"
echo "Imagen esperada: assets/img/$folder.jpg"
echo "----------------------------------------"