# 控制台镜像：Vite 构建出静态页，nginx 托管；/api 与 /ws 反代到后端（同源，前端不用配地址）。
# 后端地址由 BACKEND_UPSTREAM 决定（默认 backend:8000，即后端仓 docker-compose.yml 里的服务名）。

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# nginx 官方镜像启动时用环境变量渲染 /etc/nginx/templates/*.template 到 conf.d
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_UPSTREAM=backend:8000
EXPOSE 80
