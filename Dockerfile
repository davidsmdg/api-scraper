# Usamos Node 20 como base
FROM node:20-slim

# Instalamos dependencias de Google Chrome para Puppeteer en Debian
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Establecemos el directorio de trabajo
WORKDIR /usr/src/app

# Instalamos pnpm de forma global
RUN npm install -g pnpm

# Copiamos los archivos de dependencias primero
COPY package.json pnpm-lock.yaml ./

# Instalamos las librerías
RUN pnpm install --frozen-lockfile

# Copiamos el resto del código del proyecto
COPY . .

# Exponemos el puerto 3000
EXPOSE 3000

# Añadimos un usuario no-root por seguridad
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /usr/src/app

USER pptruser

# Comando para arrancar el servidor
CMD ["node", "index.js"]