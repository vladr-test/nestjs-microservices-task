FROM node:20-alpine

WORKDIR /app

COPY package.json ./

COPY services/ ./services/

RUN npm install

WORKDIR /app/services/libs/mongo
RUN npm run build

WORKDIR /app/services/libs/redis
RUN npm run build

WORKDIR /app/services/service-a
RUN npm run build

RUN mkdir -p data uploads

WORKDIR /app/services/service-a

CMD ["node", "dist/main"]
