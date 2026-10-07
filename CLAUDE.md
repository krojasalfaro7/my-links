# my-links

Sitio de GitHub Pages (`docs/`) para ver y gestionar mis links personales, públicos y privados. Dominio: https://link.ubbedigital.com (CNAME en Namecheap -> `krojasalfaro7.github.io`; no pasa por el nginx del VPS).

## Convenciones

- Una sola rama: `develop` (Pages se publica desde ahí). Commit y push directo, sin PRs.
- El sitio es estático (HTML + JS sin build, Firebase por CDN). Validar sintaxis con `node --check docs/assets/*.js`.
- Antes de cada commit que toque `docs/assets/`, correr `scripts/version.sh` (agrega `?v=` a los CSS/JS para saltarse la caché).
- Textos y commits en español; commits cortos en imperativo.

## Datos

- El repo y la página son públicos: los links privados **nunca** van en el repo, solo en Firestore (`links_privados`).
- Firestore: `links_publicos` (lectura abierta), `links_privados` y `config` (ver `firestore.rules`). Escribe solo el dueño, autorizado por UID de sus dos cuentas de Auth.
- Login: Google (`krojas.alfaro7@gmail.com`) o clave (cuenta de correo/contraseña `krojas.alfaro7+links@gmail.com`, la valida Firebase Auth).
- La config web de Firebase es pública por diseño; lo que protege los datos son las reglas.
- Archivos locales sensibles van en `privado/` (en `.gitignore`).
