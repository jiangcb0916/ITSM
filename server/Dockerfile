# ========== 构建阶段 ==========
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖定义
COPY package*.json ./

# 安装所有依赖（含 devDependencies 用于编译 TypeScript）
RUN npm ci

# 复制源码并编译
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ========== 运行阶段 ==========
FROM node:18-alpine AS runner

WORKDIR /app

# 仅复制生产依赖
COPY package*.json ./
RUN npm ci --omit=dev

# 从构建阶段复制编译产物
COPY --from=builder /app/dist ./dist

# 创建上传目录（挂载 volume 时由宿主机提供，此处确保默认存在）
RUN mkdir -p /app/uploads

EXPOSE 3011

# 使用 node 直接运行编译后的入口
CMD ["node", "dist/index.js"]
