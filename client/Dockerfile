# ========== 构建阶段 ==========
FROM node:18-alpine AS builder

WORKDIR /app

# 构建时传入前端 API 地址（宿主机访问后端的地址，如 http://localhost:3011/api）
ARG REACT_APP_API_URL=http://localhost:3011/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ========== 运行阶段：Nginx 提供静态资源 ==========
FROM nginx:alpine

# 删除默认配置，使用自定义配置
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3010

CMD ["nginx", "-g", "daemon off;"]
