# Docker 部署说明（IT 工单系统）

本方案使用 Docker 与 Docker Compose 一键部署前端、后端与 PostgreSQL，适用于 CentOS 8 等 Linux 服务器或本地开发环境。

---

## 完整 docker-compose 怎么做（前端 + 后端 + db）

在**项目根目录**（和 `docker-compose.yml` 同级）按顺序执行：

```bash
# 1. 进入项目根目录（不要进 client/ 或 server/）
cd /path/to/ITSM

# 2. 复制环境变量模板并编辑（必填：DB_PASSWORD、JWT_SECRET）
cp .env.example .env
vim .env   # 或 nano .env

# 3. 构建并启动三个服务（db → backend → frontend）
docker compose up -d --build

# 4. 查看是否都起来
docker compose ps
```

**访问**：前端 http://localhost:3010 ，后端 API http://localhost:3011 。  
数据库首次启动会自动执行 `server/scripts/init.sql` 建表，无需手动画表。

| 常用命令 | 说明 |
|----------|------|
| `docker compose logs -f` | 看所有服务日志 |
| `docker compose logs -f backend` | 只看后端 |
| `docker compose down` | 停止并删容器（数据卷保留） |
| `docker compose up -d --build` | 重新构建并启动 |

---

## 一、前置要求

- 已安装 [Docker](https://docs.docker.com/engine/install/) 与 [Docker Compose](https://docs.docker.com/compose/install/)（或 Docker 内置 `docker compose`）
- 端口 **3010**（前端）、**3011**（后端）未被占用

## 二、项目内与 Docker 相关文件

| 文件/目录 | 说明 |
|-----------|------|
| `server/Dockerfile` | 后端镜像：Node 18 多阶段构建，编译 TypeScript 后运行 `node dist/index.js` |
| `client/Dockerfile` | 前端镜像：Node 18 构建 React，Nginx Alpine 提供静态资源 |
| `client/nginx.conf` | Nginx 配置：监听 3010，SPA 路由 `try_files $uri /index.html` |
| `docker-compose.yml` | 编排 db、backend、frontend 三服务及卷、环境变量 |
| `.env.example` | 环境变量模板，复制为 `.env` 后按需修改 |
| `start.sh` | 一键启动脚本 |
| `data/uploads` | 宿主机上传目录，挂载到后端容器，持久化附件 |

## 三、部署步骤

### 1. 配置环境变量

在项目根目录执行：

```bash
cp .env.example .env
# 编辑 .env，至少设置：
#   DB_PASSWORD=你的数据库密码
#   JWT_SECRET=你的 JWT 密钥
# 若需限制注册邮箱，设置 ALLOWED_EMAIL_DOMAINS=company.com,company.cn
# 若部署到服务器，将 REACT_APP_API_URL 改为用户访问后端的地址，例如：
#   REACT_APP_API_URL=http://your-server-ip:3011/api
```

### 2. 构建并启动

```bash
# 方式一：使用启动脚本（会创建 data/uploads 并检查 .env）
chmod +x start.sh
./start.sh

# 方式二：直接使用 Docker Compose
mkdir -p data/uploads
docker compose up -d
```

首次会拉取基础镜像并构建 `backend`、`frontend`，可能需要几分钟。

### 3. 数据库初始化

PostgreSQL 容器**首次启动**时会自动执行 `server/scripts/init.sql`（挂载到 `/docker-entrypoint-initdb.d/01-init.sql`），无需手动建表。  
若之前已用同一数据卷启动过，不会再次执行；需要全新库时可删除卷后重启：

```bash
docker compose down -v   # 会删除 pg-data 卷，慎用
docker compose up -d
```

### 4. 访问应用

- **前端**：http://localhost:3010  
- **后端 API**：http://localhost:3011  

服务器部署时，将 `localhost` 换为服务器 IP 或域名；若前端与后端不同域名，需在构建前端时设置正确的 `REACT_APP_API_URL`（见下文「前端 API 地址」）。

## 四、常用命令

| 操作 | 命令 |
|------|------|
| 查看运行状态 | `docker compose ps` |
| 查看日志（全部） | `docker compose logs -f` |
| 仅后端日志 | `docker compose logs -f backend` |
| 停止服务 | `docker compose down` |
| 重新构建并启动 | `docker compose up -d --build` |
| 仅重建前端 | `docker compose build frontend --no-cache && docker compose up -d frontend` |

## 五、端口与数据持久化

- **端口**：前端 3010、后端 3011；数据库不暴露到宿主机，仅容器内访问。
- **数据库**：使用命名卷 `pg-data`，数据持久化在 Docker 卷中。
- **上传文件**：宿主机 `./data/uploads` 挂载到后端容器 `/app/uploads`，附件不随容器删除而丢失。

## 六、前端 API 地址（REACT_APP_API_URL）

前端在**构建时**将 `REACT_APP_API_URL` 写入静态资源，浏览器请求后端时使用该地址。  
本地部署默认 `http://localhost:3011/api` 即可。  
部署到服务器时：

1. 在 `.env` 中设置，例如：`REACT_APP_API_URL=http://your-server:3011/api`
2. 重新构建并启动前端：
   ```bash
   docker compose build frontend --no-cache
   docker compose up -d frontend
   ```

若通过 Nginx 反向代理将 `/api` 转发到后端，可设为 `REACT_APP_API_URL=/api`，并在前端 Nginx 中配置 `proxy_pass`（当前方案为前后端分离直连，未做 Nginx 代理）。

## 七、可选：健康检查与依赖顺序

- **db**：使用 `pg_isready` 做健康检查；**backend** 在 db 健康后再启动。
- **backend**：对 `/api/auth/me` 做 HTTP 健康检查（401/200 均视为就绪）。
- **frontend**：依赖 backend 启动顺序，但不做健康检查（静态资源立即可用）。

## 八、在 CentOS 8 上安装 Docker（简要）

```bash
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# 重新登录后即可使用 docker / docker compose
```

然后在本项目根目录按上述步骤执行 `cp .env.example .env`、配置 `.env`、运行 `./start.sh` 或 `docker compose up -d` 即可。
