# Agent Ready Shop — web (analyzer + API). Runs on any container host or VPS.
#   docker build -t agent-ready-shop .
#   docker run -p 3000:3000 -e NODE_ENV=production agent-ready-shop
FROM node:22-slim
WORKDIR /app

# Install deps first (better layer caching).
COPY package*.json ./
RUN npm ci

# App source (plugin/ is needed at runtime for /api/download-plugin).
COPY . .

# Build the frontend + bundle the server to dist/server.cjs.
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
