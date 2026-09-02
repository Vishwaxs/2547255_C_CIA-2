# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
# prisma is a devDependency, but @prisma/client declares it as an optional peer, so npm
# records it as non-dev and `npm ci --omit=dev` keeps the CLI. That is an npm resolution
# detail rather than a guarantee, and `npx prisma` would paper over its absence by silently
# fetching an unpinned CLI from the registry at boot — which resolves to the newest major
# and cannot migrate a v5 schema. Invoking the local binary by path fails loudly instead.
# Drop root too: the API binds a high port and never writes to its own code.
RUN chown -R node:node /app
USER node

EXPOSE 4006
# Apply pending migrations, then start the API + dispatcher worker.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/server.js"]
