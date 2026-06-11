# SPA image — used by the Railway service with root directory /frontend.
# nginx serves the build and proxies /api + /uploads to the backend service
# over Railway's private network (BACKEND_URL).
FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM nginx:alpine
ENV PORT=8080
ENV BACKEND_URL=http://forgecms.railway.internal:8080
ENV BACKEND_HOST=forgecms.railway.internal
COPY --from=build /build/dist /usr/share/nginx/html
# The nginx image envsubsts *.template into /etc/nginx/conf.d/ at startup
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
