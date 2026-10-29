# Colindantes · FelipeDMC

Página en español para extraer colindancias y coordenadas de imágenes de planos y documentos, revisar los resultados y copiarlos o descargarlos como TXT.

Incluye el diseño, el logo de FelipeDMC, los iconos de instalación, el motor OCR y el modelo de español. Usa HTML, CSS y JavaScript. No requiere claves de API, base de datos, npm ni compilación para publicarse. El reconocimiento de texto se ejecuta en el navegador.

## Publicar en GitHub Pages

1. Descomprime el ZIP y crea un repositorio en GitHub; por ejemplo, `colindantes`.
2. Sube **el contenido de esta carpeta** a la raíz del repositorio. Debes ver `index.html` junto a `README.md`, `coordenadas.html` y `assets`. No subas únicamente el ZIP.
3. Abre **Settings → Pages → Build and deployment**.
4. Selecciona **Deploy from a branch**, rama **main**, carpeta **/(root)** y pulsa **Save**.
5. Cuando termine la publicación, GitHub mostrará el enlace de la página.

Las rutas están adaptadas para un sitio como `https://TU_USUARIO.github.io/colindantes/`. También funcionan en la raíz de un dominio. Conserva `assets` completa.

Consulta [PUBLICAR-EN-GITHUB.md](PUBLICAR-EN-GITHUB.md) para instrucciones detalladas.

## Funciones

- Imágenes PNG, JPEG, WebP y BMP; carga, arrastre y pegado.
- Ocho vientos: norte, oriente, sur, poniente, noreste, sureste, suroeste y noroeste.
- Orden detectado en la fuente y agrupación de tramos de un mismo viento.
- Lectura de rótulos en distintas posiciones; no exige que «poniente» esté a la izquierda.
- Edición y revisión de nombres, medidas y coordenadas.
- Texto habitual, mayúsculas o minúsculas.
- Coordenadas en formato `punto, X, Y`, conservando decimales y números de punto.
- Copia al portapapeles y descarga de TXT.
- Aplicación instalable (PWA) con iconos y caché local.

Ejemplo:

```text
1, 586986.0588, 2235977.7607
2, 587031.4698, 2235971.2457
3, 587037.4478, 2235960.8367
```

## Probar en tu computadora

Si tienes Python 3, abre una terminal en esta carpeta y ejecuta:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

En Windows puedes usar `py -m http.server 8080 --bind 127.0.0.1`.

Abre `http://localhost:8080/`. Para detener el servidor, pulsa Ctrl+C. Usa un servidor local: abrir el HTML con doble clic no permite ejecutar correctamente los módulos y el OCR. En producción utiliza HTTPS, como el que proporciona GitHub Pages.

## Archivos principales

| Archivo o carpeta | Función |
| --- | --- |
| `index.html` | Interfaz de colindantes |
| `coordenadas.html` | Interfaz de coordenadas |
| `style.css`, `polish.css` | Diseño adaptable y firma de FelipeDMC |
| `app.mjs`, `parser.mjs` | Interacción y extracción de colindancias |
| `coordinate-app.mjs`, `coordinates.mjs` | Lectura y exportación de coordenadas |
| `imaging.mjs` | Preparación de imágenes y carga del OCR |
| `pwa.mjs`, `manifest.webmanifest`, `sw.js` | Instalación y caché |
| `assets/` | Logo, iconos, ejemplos, motor OCR, modelo de español y licencias |
| `scripts/check.mjs` | Verificación opcional de rutas, recursos y caché |
| `TERCEROS.md` | Componentes, versiones y procedencia |
| `SHA256SUMS.txt` | Huellas de los archivos de esta entrega |

Para ejecutar las verificaciones opcionales, con Node.js instalado:

```bash
node scripts/check.mjs
```

## Personalización

- El logo es `assets/felipedmc-logo.png` y se muestra al pie de ambas páginas.
- La firma «Creado por FelipeDMC» está en ambos HTML; sus estilos, al final de `polish.css`.
- Los iconos de instalación son `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` y `apple-touch-icon.png`, dentro de `assets`.
- El nombre de la app se configura en `manifest.webmanifest` y en los títulos de ambos HTML.
- Al actualizar recursos, incrementa el sufijo de `CACHE` en `sw.js` para renovar la caché.

## Alcance

Lee texto impreso y legible. No calcula medidas a partir de la geometría ni deduce vientos ausentes. El OCR puede confundir letras o números: revisa los resultados. El ejemplo inicial se identifica como ejemplo.

Las imágenes se procesan en tu dispositivo. Se guardan recursos de funcionamiento en la caché del navegador; la app no incorpora un historial de imágenes o resultados. Para reutilizar el OCR sin conexión primero deben haberse descargado sus recursos mediante un análisis con conexión; el navegador puede eliminar su caché.

## Sobre esta entrega

Parte de la versión con el logo de FelipeDMC. Los archivos de la carpeta original `dist/` se colocaron en la raíz para facilitar la publicación. Se adaptaron enlaces, rutas del OCR, manifiesto y service worker a subcarpetas. Se conservaron los módulos de extracción y los recursos originales y se añadieron documentación y avisos de terceros.

Código fuente de origen: `9999d5a570057c1d5665e95afddcd60ba1208947`.

Los componentes de terceros mantienen sus licencias. Consulta [TERCEROS.md](TERCEROS.md).
