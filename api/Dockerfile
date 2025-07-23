# api/Dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./

ENV NODE_ENV=development

RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build

RUN cp -r src/generated dist/src/

CMD [ "node", "dist/src/index.js"]