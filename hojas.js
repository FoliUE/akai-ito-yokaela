const TOTAL_HOJAS = 100;

const TITULOS = {
  1: "Primera hoja",
  2: "Segunda hoja",
  3: "Tercera hoja",
  4: "Cuarta hoja"
};

const HOJAS = Array.from({ length: TOTAL_HOJAS }, (_, i) => {
  const numero = i + 1;

  return {
    numero,
    titulo: TITULOS[numero] || `Hoja ${String(numero).padStart(2, "0")}`,
    subtitulo: "Abrir página"
  };
});