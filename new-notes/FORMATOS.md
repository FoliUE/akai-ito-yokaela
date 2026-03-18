# Formatos para `mica.note` y `leo.note`

Si abrís `tools/notes-manager/nueva_hoja.bat`, `tools/notes-manager/nueva_hoja.sh` o `tools/notes-manager/nueva_hoja.command`, el programa ya trae esta ayuda adentro.
Mientras pegás contenido nuevo podés escribir:

- `:ayuda` para ver la guía rápida.
- `:ejemplos` para ver bloques listos para copiar.
- `:fin` para guardar.
- `:cancelar` para salir sin guardar.

La imagen central `assets/img/new-notes/XX.jpeg` se prepara siempre.
Si elegís una foto al crear la hoja, el gestor la copia ahí.
Si no, deja el archivo JPEG vacío para que lo reemplaces después.

Cada hoja nueva queda separada en:

- `note.json`: metadata de la página, foto, orden, layout y música.
- `mica.note`: bloque de Mica.
- `leo.note`: bloque de Leo.

## Frontmatter

Arriba de cada archivo podés usar:

```txt
---
title: Título del bloque
helper: 17/03/26
spoiler: false
variant: solo
placeholder: true
placeholderBody: Esta hoja queda abierta para cuando quieras escribir.
---
```

- `title`: título del bloque.
- `helper`: fecha, referencia o subtítulo corto.
- `spoiler`: si querés esconder el bloque hasta tocar "Ver nota".
- `variant: solo`: usa el estilo de tarjeta grande centrada.
- `placeholder: true`: deja el bloque vacío pero reservado.
- `placeholderBody`: mensaje que aparece mientras falta ese bloque.

## Texto normal

Separá párrafos con una línea en blanco.

```txt
Este es el primer párrafo.

Este es el segundo.
```

También podés usar:

- `*cursiva*`
- `**negrita**`
- `~~tachado~~`

## Cita

```txt
:::quote
*Lo besé, respirando el aroma de su piel...*
- Louisa Clark x Me Before You
:::
```

La última línea que empieza con `-` o `—` se manda automáticamente a la derecha como autoría.

## Canción o poema

```txt
:::song
No respiro, me quema el dolor
Esta asfixia me quiebra el corazón

Mi lindo amor no correspondido
Mi chispa de fe

- En la oscuridad - Leo, para vos mi amor.
:::
```

Las líneas se respetan dentro de cada estrofa y la autoría se alinea a la derecha.

## Diálogo

```txt
:::dialogue
Lucifer: Are you okay?
Chloe: If I pushed this into your chest... it would kill you?
Lucifer: Yes.

- Lucifer
:::
```

## Cita grande

```txt
:::hero-quote
¿TE QUERÉS CASAR CONMIGO?
:::
```

## Imagen dentro del bloque

```txt
:::image
src=../../assets/img/timon.png
alt=Timón para la hoja
fit=contain
height=240px
padding=24px
background=rgba(255,255,255,0.03)
caption=Una imagen para acompañar la nota.
:::
```

## Separador

```txt
---
```
