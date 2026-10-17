FROM node:24-alpine
WORKDIR /srv/bff
ENV NODE_ENV=production DATA_DIR=/srv/bff/data
COPY package.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p /srv/bff/data && chown -R node:node /srv/bff
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O - http://127.0.0.1:8787/app/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
