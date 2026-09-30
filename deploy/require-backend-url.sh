#!/bin/sh
# nginx 镜像的启动钩子（/docker-entrypoint.d/ 下按文件名顺序执行，早于 20-envsubst 渲染模板）。
# BACKEND_URL 必须是「协议 + 主机[:端口]」：没设时模板里会留下字面量、/api 全部 502；带了路径（哪怕只是
# 末尾的 /）时 nginx 会用它替换整个请求 URI。两种情况都启动即失败，日志说清楚。
set -e
rest="${BACKEND_URL#http://}"
rest="${rest#https://}"
if [ -z "${BACKEND_URL:-}" ] || [ "$rest" = "$BACKEND_URL" ] || [ -z "$rest" ]; then
  echo "BACKEND_URL 未设置或缺少协议（例如 https://api.example.com），拒绝启动" >&2
  exit 1
fi
case "$rest" in
  */*)
    echo "BACKEND_URL 只能是协议加主机（例如 https://api.example.com），不要带路径或末尾的 /：$BACKEND_URL" >&2
    exit 1
    ;;
esac
