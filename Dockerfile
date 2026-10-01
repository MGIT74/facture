# --- 1) build du frontend Vue ---
FROM node:22-alpine AS front
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2) API Node qui sert aussi le frontend compilé ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=front /app/frontend/dist /app/frontend/dist
EXPOSE 3000
CMD ["node", "src/index.js"]
