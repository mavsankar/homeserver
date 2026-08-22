FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
USER node
EXPOSE 8888
CMD ["node", "server.js"]
