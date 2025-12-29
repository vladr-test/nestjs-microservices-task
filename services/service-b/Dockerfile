FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    python3 \
    make \
    g++ \
    fontconfig \
    ttf-dejavu \
    ttf-liberation

# Update font cache
RUN fc-cache -f -v

COPY services/ ./services/

WORKDIR /app/services/libs/mongo
RUN npm install

WORKDIR /app/services/libs/redis
RUN npm install

WORKDIR /app/services/service-b
RUN npm install && npm rebuild canvas --build-from-source

WORKDIR /app/services/libs/mongo
RUN npm run build

WORKDIR /app/services/libs/redis
RUN npm run build

WORKDIR /app/services/service-b
RUN npm run build

WORKDIR /app/services/service-b

CMD ["node", "dist/main"]
