# 控制台镜像：Vite 构建出静态页，nginx 托管；/api 与 /ws 反代到后端（浏览器只和本站同源通信）。
# 运行时必须给 BACKEND_URL（带协议的后端地址，如 https://api.example.com），没给就拒绝启动。

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
COPY deploy/require-backend-url.sh /docker-entrypoint.d/05-require-backend-url.sh
# 入口脚本只执行带可执行位的钩子，不依赖仓库里的文件权限
RUN chmod 755 /docker-entrypoint.d/05-require-backend-url.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
