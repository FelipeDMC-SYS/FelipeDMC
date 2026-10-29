# Publicar Colindantes en GitHub

El paquete está listo para alojarse como una web estática. No necesitas instalar dependencias ni configurar secretos.

## Desde el navegador

1. Descomprime `colindantes-felipedmc-github.zip`.
2. En GitHub crea un repositorio llamado, por ejemplo, `colindantes`. Puedes usar un repositorio público para GitHub Pages con una cuenta gratuita.
3. Abre **Add file → Upload files**. Si está vacío, usa el enlace para subir un archivo existente.
4. Arrastra **todos los archivos y carpetas que están dentro de la carpeta descomprimida**, incluida `assets`. No arrastres la carpeta contenedora ni el ZIP. Si tu explorador oculta `.nojekyll`, créalo después desde **Add file → Create new file** con ese nombre; puede estar vacío.
5. Guarda con **Commit changes** en la rama `main`.
6. Confirma que `index.html` esté directamente en la raíz del repositorio.
7. Abre **Settings → Pages**. En **Build and deployment**, elige **Deploy from a branch**, **main**, **/(root)** y pulsa **Save**.
8. Espera a que finalice la publicación y abre el enlace que muestre GitHub. Puedes consultar el progreso en **Actions**.

El enlace habitual tiene esta forma: `https://TU_USUARIO.github.io/colindantes/`. Sustituye el nombre del repositorio si usaste otro.

## Con Git

Crea un repositorio vacío en GitHub. Abre una terminal dentro de la carpeta descomprimida:

```bash
git init
git add .
git commit -m "Publicar Colindantes de FelipeDMC"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/colindantes.git
git push -u origin main
```

Cambia `TU_USUARIO` y el nombre del repositorio. GitHub solicitará tu autenticación habitual si no la tienes configurada. Después activa Pages siguiendo los pasos 7 y 8 anteriores.

## Comprobar la página

- Abre Colindantes y Coordenadas desde el menú; confirma que se ven los ejemplos y el logo.
- Ejecuta la lectura de una imagen de ejemplo; la primera vez se descargan los archivos OCR desde tu propio sitio.
- Copia o descarga el resultado de coordenadas como TXT.
- En un navegador compatible, usa «Instalar app».

## Problemas habituales

| Problema | Qué revisar |
| --- | --- |
| Error 404 | `main` y `/(root)` en Pages, `index.html` en la raíz y publicación terminada. |
| Faltan estilos o imágenes | Sube todos los archivos, respetando sus nombres y mayúsculas. |
| El OCR no inicia | Conserva en `assets` los archivos `.wasm`, `.wasm.js`, `worker.min.js`, `tesseract.min.js` y `spa.traineddata.gz`. |
| Versión antigua | Incrementa el sufijo de `CACHE` en `sw.js`, publica y vuelve a abrir la web. |
| No funciona con doble clic | Usa el servidor local de `README.md` o el enlace HTTPS de GitHub Pages. |

## Documentación oficial

- [Configurar el origen de publicación](https://docs.github.com/es/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Crear un sitio de GitHub Pages](https://docs.github.com/es/pages/getting-started-with-github-pages/creating-a-github-pages-site)

Esta entrega contiene los archivos preparados para publicar. No se ha creado ni publicado un repositorio en tu cuenta de GitHub.
