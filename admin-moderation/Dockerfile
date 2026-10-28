# this is a speacial comment that tells the docker which dockerfile feature version  to use 
# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22-alpine
FROM node:${NODE_VERSION} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production PORT=5006
#/-------bin/
#--------etc/
#--------home/
#--------app/
#so the container might look like this 
WORKDIR /app
#adds or creates a group in the container and adds a new created user that is named as app in it 
RUN addgroup -S app && adduser -S app -G app
COPY --from=dependencies /app/node_modules ./node_modules
#For example, without --chown, files copied into the runtime stage are generally owned by root by default.
#With --chown=app:app, the copied files are assigned to the app user and group instead.

COPY --chown=app:app . ./
USER app
EXPOSE 5006
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
