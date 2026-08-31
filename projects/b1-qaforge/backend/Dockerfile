# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npx tsc -p tsconfig.json

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4001
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
# prisma is a devDependency, but @prisma/client declares it as an optional peer, so npm
# records it as non-dev and `npm ci --omit=dev` keeps the CLI. That is an npm resolution
# detail rather than a guarantee, and `npx prisma` would paper over its absence by silently
# fetching an unpinned CLI from the registry at boot — which resolves to the newest major
# and cannot migrate a v5 schema. Invoking the local binary by path fails loudly instead.
# Drop root too: the API binds a high port and never writes to its own code.
RUN chown -R node:node /app
USER node

EXPOSE 4001
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/server.js"]
