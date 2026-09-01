FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm install --workspace=apps/api

COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

WORKDIR /app/apps/api

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/prisma ./prisma

ENV NODE_ENV=production

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push && node dist/main.js"]
