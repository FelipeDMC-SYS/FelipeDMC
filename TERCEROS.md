# Componentes incluidos

La aplicación usa HTML, CSS y módulos JavaScript, con Canvas, Web Workers, WebAssembly, portapapeles, archivos locales y Service Workers. No requiere un framework, servidor de aplicación, base de datos ni claves de API.

## OCR

| Componente | Versión | Archivos en assets | Proyecto |
| --- | --- | --- | --- |
| Tesseract.js | 6.0.1 | `tesseract.min.js`, `worker.min.js` | [naptha/tesseract.js](https://github.com/naptha/tesseract.js) |
| Tesseract.js-core | 6.0.0 | `tesseract-core-lstm.wasm*`, `tesseract-core-simd-lstm.wasm*` | [naptha/tesseract.js-core](https://github.com/naptha/tesseract.js-core) |
| Modelo de español | `@tesseract.js-data/spa@1.0.0`, variante `4.0.0_best_int` | `spa.traineddata.gz` | [naptha/tessdata](https://github.com/naptha/tessdata) |

La app configura explícitamente el motor LSTM y las rutas locales de `workerPath`, `corePath` y `langPath`. Incluye las variantes SIMD y no SIMD. No necesita un CDN durante el uso; las direcciones predeterminadas dentro de los archivos del proveedor se sustituyen por esta configuración.

Los módulos de la aplicación se entregan como fuente editable. Los componentes de los proveedores y el modelo OCR se entregan en sus formatos de distribución; los enlaces anteriores contienen sus proyectos fuente.

## Licencias y avisos

- `assets/TESSERACT-LICENSE.txt`: Apache 2.0 de Tesseract.js.
- `assets/TESSERACT-CORE-LICENSE.txt`: Apache 2.0 de Tesseract.js-core.
- `assets/TESSDATA-LICENSE.txt`: Apache 2.0 publicada por el repositorio de datos de idioma.
- `assets/tesseract.min.js.LICENSE.txt` y `assets/worker.min.js.LICENSE.txt`: avisos incluidos en los paquetes JavaScript del proveedor.

Conserva estos archivos al redistribuir los componentes. Sus licencias no cambian la atribución del logo FelipeDMC.

## Recursos gráficos

- `felipedmc-logo.png`: logo original proporcionado por FelipeDMC, sin alterar sus píxeles.
- `icon.svg` y los PNG de instalación: iconos de la app Colindantes.
- `ejemplo.png` y `coordenadas-ejemplo.png`: imágenes de demostración ya incluidas en la página.

Los estilos, módulos de extracción, interfaz, caché y documentación están incluidos. No necesitas las herramientas utilizadas durante el desarrollo para publicar o ejecutar la página.
