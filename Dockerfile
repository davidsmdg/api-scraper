# Usamos la imagen oficial de Puppeteer (basada en Debian)
FROM ghcr.io/puppeteer/puppeteer:latest

# 1. Cambiamos a root para instalar pnpm y configurar carpetas
USER root

# Instalamos pnpm de forma global
RUN npm install -g pnpm

# Establecemos el directorio de trabajo
WORKDIR /usr/src/app

# Aseguramos que el usuario seguro (pptruser) sea dueño de la carpeta de la app
RUN chown -R pptruser:pptruser /usr/src/app

# 2. Volvemos al usuario seguro para evitar ejecutar código como root
USER pptruser

# Copiamos los archivos de dependencias primero (aprovecha el cache de Docker)
COPY --chown=pptruser:pptruser package.json pnpm-lock.yaml ./

# Instalamos las librerías
RUN pnpm install --frozen-lockfile

# Copiamos el resto del código del proyecto
COPY --chown=pptruser:pptruser . .

# Exponemos el puerto 3000 (el que configuramos en index.js y Easypanel)
EXPOSE 3000

# Comando para arrancar el servidor
# Usamos el formato de array para una mejor gestión de señales de cierre
CMD ["node", "index.js"]