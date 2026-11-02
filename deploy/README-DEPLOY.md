# Despliegue de Veta Roja en tu servidor

Veta Roja corre con **Docker Compose** en un servidor que tú controlas: la aplicación (Node), Postgres y Caddy (HTTPS).
Todo se aloja ahí: fuentes, imágenes, QR y base de datos. No hay CDN, analítica ni correo de terceros.

> **Lo único externo:** Caddy pide el certificado HTTPS a Let's Encrypt, **solo al emitirlo y al renovarlo**.
> Si prefieres no depender de eso, usa un certificado propio (ver "Certificado propio").

## Requisitos

- Un servidor Linux con **Docker** y **Docker Compose** (v2).
- Puertos **80 y 443** abiertos hacia internet.
- El dominio (`vetaroja.mx`) con un registro **A** (y **AAAA** si tienes IPv6) apuntando a la IP del servidor.
  **El dominio va impreso en los QR: tiene que ser definitivo.**

## Primer arranque

```bash
git clone <tu-repositorio> veta-roja && cd veta-roja
cp deploy/.env.example deploy/.env
nano deploy/.env          # POSTGRES_PASSWORD, PUBLIC_BASE_URL=https://vetaroja.mx, SITE_ADDRESS=vetaroja.mx

docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps     # los 3 servicios deben quedar "running"
```

La primera vez, la base de datos se crea sola (las migraciones corren al iniciar la aplicación).

> Atajo para no repetir las banderas: `export COMPOSE="docker compose -f deploy/docker-compose.yml --env-file deploy/.env"`

## Crear al administrador

```bash
$COMPOSE exec -it app npm run admin:create -- admin
# pide la contraseña (mínimo 12 caracteres) sin mostrarla.
# También puedes pasarla con: $COMPOSE exec -e ADMIN_PASSWORD='...' app npm run admin:create -- admin
```

Entra en `https://vetaroja.mx/admin`.

### Si pierdes la contraseña

No hay correo de recuperación. Se restablece en el servidor:

```bash
$COMPOSE exec -it app npm run admin:reset -- admin
```

Esto cierra todas las sesiones abiertas de ese usuario.

## Después de instalar

1. En **Ajustes**, escribe el enlace de tu canal de WhatsApp (el botón "Entrar al canal" lo usa en todas las landings).
2. Crea tu primera landing, publícala y descarga su QR desde el mismo editor.
3. Comprueba que todo responde desde otra máquina:

```bash
ADMIN_USER=admin ADMIN_PASSWORD='tu-contraseña' node deploy/smoke.mjs https://vetaroja.mx
```

La prueba de humo crea una landing temporal, verifica que se sirve ya renderizada, que su QR es un PNG y que renombrar
el slug deja una redirección, y al final la borra. Sale con código 0 si todo está bien.

## Respaldos

```bash
bash deploy/backup.sh            # crea backups/db-<fecha>.sql.gz y backups/uploads-<fecha>.tgz
```

Programa ese comando (cron) y **copia la carpeta `backups/` fuera del servidor**.

### Restaurar

```bash
# Base de datos (reemplaza lo existente)
gunzip -c backups/db-AAAA-MM-DD_HHMMSS.sql.gz | $COMPOSE exec -T postgres psql -U vetaroja -d veta_roja
# Imágenes subidas
$COMPOSE exec -T app tar xzf - -C /data/uploads < backups/uploads-AAAA-MM-DD_HHMMSS.tgz
```

## Actualizar

```bash
git pull
$COMPOSE up -d --build
```

Las migraciones nuevas se aplican al arrancar. Los datos (Postgres, imágenes, certificados) viven en volúmenes y no se pierden.

## Certificado propio

En `deploy/Caddyfile` descomenta la línea `tls /certs/fullchain.pem /certs/privkey.pem` y monta tus archivos en el servicio
`caddy` de `deploy/docker-compose.yml` (por ejemplo `./certs:/certs:ro`).

## Probar en tu computadora (sin HTTPS)

```bash
printf 'POSTGRES_PASSWORD=prueba-local-123\nPUBLIC_BASE_URL=http://localhost\nSITE_ADDRESS=:80\n' > deploy/.env
$COMPOSE up -d --build
```

Nota: con `NODE_ENV=production` la cookie de sesión es `secure`, así que el navegador solo la guarda por HTTPS; para
entrar al panel desde `http://localhost` usa el servidor de desarrollo (`npm run start -w server`) en lugar de este compose.
La prueba de humo sí funciona contra `http://localhost` porque envía la cookie a mano.

## Seguridad

- Deja abiertos solo los puertos 80 y 443. La aplicación (`app:3000`) y Postgres no se publican fuera de Docker.
- El panel está en `/admin`, protegido por sesión y con límite de 5 intentos de acceso por minuto por dirección IP.
- No versiones `deploy/.env` ni la carpeta `backups/`.
