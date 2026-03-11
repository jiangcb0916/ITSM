# IT 工单系统 (ITSM)

基于 React + Node.js + PostgreSQL 的 IT 工单管理系统，支持 JWT 认证、角色权限（普通用户 / 技术人员 / 管理员）、工单创建/分配/状态更新、评论与附件、邮件通知及管理端统计图表。

## 技术栈

- **前端**: React 18 + TypeScript + Ant Design
- **后端**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL
- **认证**: JWT
- **通知**: Nodemailer（SMTP 邮件）

## 功能概览

- **用户**: 注册/登录、创建工单、查看自己的工单、评论、上传附件
- **技术人员**: 查看分配给自己的工单、更新状态、添加备注（含内部备注）
- **管理员**: 查看全部工单、筛选/搜索、分配指派、查看统计与图表
- **通知**: 工单状态变更或新评论时发送邮件（需配置 SMTP）

## 项目结构

```
ITSM/
├── client/                 # React 前端
│   ├── public/
│   └── src/
│       ├── api/            # API 与类型
│       ├── components/
│       ├── context/        # 认证上下文
│       └── pages/          # 登录、注册、工单列表、工单详情、管理仪表盘
├── server/                 # Express 后端
│   ├── scripts/
│   │   └── init.sql        # 数据库建表脚本
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── db/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/       # 邮件服务
│       └── types/
├── data/                   # 运行时生成：上传文件等（见 .gitignore）
└── README.md
```

## 快速开始

### 1. 环境要求

- Node.js 18+
- PostgreSQL 14+（Mac 可用 `brew install postgresql@16`，并确保 `psql`/`createdb` 在 PATH 中）
- npm 或 yarn

### 2. 创建数据库

在**项目根目录**或 **server 目录**下执行均可（`-f` 的路径按当前目录调整）：

```bash
# 创建数据库
createdb itsm

# 执行建表脚本（Mac 本地用当前用户连接时，-U 可改为 $(whoami)，无密码则不需 -W）
psql -U postgres -d itsm -f server/scripts/init.sql
```

若在**项目根目录**执行：

```bash
cd /path/to/ITSM
createdb itsm
psql -U postgres -d itsm -f server/scripts/init.sql
```

若在 **server 目录**执行：

```bash
cd server
createdb itsm
psql -U postgres -d itsm -f scripts/init.sql
```

建表脚本位置：`server/scripts/init.sql`。  
若 PostgreSQL 报错与触发器语法相关，请根据你当前 PG 版本将脚本中的 `EXECUTE PROCEDURE` 改为适用写法。

**已有数据库升级**：若在本次更新前已创建过数据库，需执行用户管理迁移脚本以增加 `status`、`last_login_at` 等字段：

```bash
# Mac 本地通常用当前系统用户连接（无 postgres 角色时）
psql -d itsm -f server/scripts/migrate-users-management.sql

# 若你使用 postgres 用户，则：
# psql -U postgres -d itsm -f server/scripts/migrate-users-management.sql
```

若需**用户软删除**（删除用户时保留数据、支持工单转移），再执行：

```bash
psql -d itsm -f server/scripts/migrate-users-soft-delete.sql
```

若需**用户级工单删除**（普通用户可从自己的列表中隐藏工单，管理员和技术员仍可见），再执行：

```bash
psql -d itsm -f server/scripts/migrate-tickets-deleted-by-user.sql
```

### 3. 安装依赖

```bash
# 后端
cd server && npm install

# 前端（若遇 peer 依赖冲突，使用 --legacy-peer-deps）
cd client && npm install
# 或
cd client && npm install --legacy-peer-deps
```

### 4. 配置环境变量

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`，本地开发示例：

| 项 | 说明 |
|----|------|
| `DB_HOST` | 一般为 `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `itsm` |
| `DB_USER` | 与建库时一致（如 Mac 本地用当前用户则为 `jiangcb` 或 `$(whoami)`） |
| `DB_PASSWORD` | 本地未设密码可留空 |
| `JWT_SECRET` | 开发可随意，**生产必须改为随机强密钥** |
| `SMTP_*` | 不配置也能运行，仅不发邮件 |

### 5. 启动服务

**必须先启动后端，再启动前端。**

**终端一 - 后端：**

```bash
cd server
npm run dev
```

看到 `ITSM server running at http://localhost:3001` 即表示后端就绪。

**终端二 - 前端：**

```bash
cd client
npm start
```

浏览器会打开 `http://localhost:3000`。前端会**直接请求** `http://localhost:3001/api`，无需代理；若后端端口或域名不同，可设置：

```bash
export REACT_APP_API_URL=http://你的后端地址/api
npm start
```

### 6. 首次使用

- **无默认账号**，需先注册。
- 打开前端 →「没有账号？去注册」→ 填写邮箱、密码（至少 6 位）、姓名，角色选「普通用户 / 技术人员 / 管理员」→ 提交后即已登录。
- 若需管理全部工单，首次注册时角色选「管理员」即可。

登录后：

- **普通用户**：创建工单（可手动选择技术员或勾选「自动分配」）、仅查看自己创建的工单、在工单详情中只读+评论与上传附件，不能编辑工单；可将工单从自己的列表中「删除」（仅对自己隐藏，管理员和技术员仍可见）。
- **技术人员**：仅查看指派给自己的工单，在工单详情中更新状态、添加评论（含内部备注）。
- **管理员**：查看全部工单、在工单详情中编辑所有字段、重新指派技术员、删除工单；在「用户管理」中管理用户。

## 常见问题

| 现象 | 处理 |
|------|------|
| 注册/登录 404 | 确认后端已启动在 3001，前端请求地址为 `http://localhost:3001/api`（见 `client/src/api/index.ts`）。 |
| 431 Request Header Fields Too Large | 后端已提高请求头限制；若仍出现，可清理浏览器对 localhost 的 Cookie 后重试。 |
| 注册失败 / 网络错误 | 确认后端 `npm run dev` 无报错，且能访问 `http://localhost:3001`。 |
| createdb / psql 找不到 | 安装 PostgreSQL 并将 `bin` 加入 PATH（如 `export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"`）。 |

## API 概览

- `GET /` — 接口说明（非 404）
- `POST /api/auth/register` — 注册
- `POST /api/auth/login` — 登录
- `GET /api/auth/me` — 当前用户（需 JWT）
- `GET /api/tickets` — 工单列表（按角色：用户看自己创建的，技术员看指派给自己的，管理员看全部；支持分页、筛选、搜索）
- `POST /api/tickets` — 创建工单（body 可选 `assigned_to` 技术员 ID；未提供或无效时自动分配给当前未完成工单最少的技术员）
- `POST /api/tickets/with-attachments` — 创建工单并上传问题截图（multipart/form-data：字段 title, description, category, priority, assigned_to；文件 screenshots 最多 5 张，仅图片，单张 ≤5MB）
- `GET /api/tickets/stats` — 统计（管理员/技术人员）
- `GET /api/tickets/:id` — 工单详情（权限：创建人/指派人/管理员）
- `PUT /api/tickets/:id` — 更新工单（技术员仅可改状态，管理员可改全部含指派人）
- `PATCH /api/tickets/:id/status` — 更新状态（管理员/技术人员）
- `PATCH /api/tickets/:id/assign` — 分配指派人（仅管理员）
- `POST /api/tickets/:id/comments` — 添加评论（创建人/指派人/管理员）
- `DELETE /api/tickets/:id` — 删除工单（仅管理员，物理删除）
- `PUT /api/tickets/:id/user-delete` — 用户级删除（仅工单创建者）：从自己的列表中隐藏该工单，管理员和技术员仍可见并处理
- `POST /api/tickets/:id/upload` — 上传附件
- `GET /api/tickets/:id/download/:attachmentId` — 下载附件
- `GET /api/users/techs` — 技术员列表（id, name, email，用于创建工单时的指派下拉框）
- `GET /api/users/technicians` — 技术人员+管理员列表（管理员，用于分配）
- `GET /api/users` — 用户列表（管理员，分页/搜索/按角色、状态筛选）
- `GET /api/users/:id` — 用户详情（管理员）
- `PATCH /api/users/:id` — 更新用户（管理员，不可修改其他管理员）
- `PATCH /api/users/:id/status` — 启用/禁用用户（管理员，不可操作其他管理员）
- `DELETE /api/users/:id` — 软删除用户（管理员；可选 body `transfer_user_id` 转移其负责的工单；不能删自己、不能删最后一名管理员）

## 生产构建与运行

```bash
# 后端
cd server && npm run build && npm start

# 前端（需先设置 REACT_APP_API_URL 为生产 API 地址）
cd client && npm run build
# 将 build 目录部署到 Nginx 或静态服务器，并配置 API 代理到后端
```

## 部署到 CentOS 8

当前数据存储方式**不影响**在 CentOS 8 上部署，按下面做即可。

1. **安装** Node.js、PostgreSQL、Nginx（可选）。
2. **代码与依赖**：将项目放到服务器，在 `server`、`client` 下执行 `npm install` 等（见上文「安装依赖」）。
3. **数据库**：在服务器上创建库 `itsm`，执行 `server/scripts/init.sql`；在 `server/.env` 中配置 `DB_HOST`、`DB_NAME`、`DB_USER`、`DB_PASSWORD` 等（指向本机或远程 PostgreSQL）。
4. **附件目录（建议）**：在服务器上使用**绝对路径**存放上传文件，避免随代码更新被覆盖：
   - 例如：`mkdir -p /var/lib/itsm/uploads`，在 `.env` 中设置 `UPLOAD_DIR=/var/lib/itsm/uploads`。
   - 赋权给运行后端的用户：`chown -R 运行后端的用户 /var/lib/itsm/uploads`。
   - 若仍用相对路径，则保证 `server/data/uploads` 存在且运行用户可写。
5. **后端**：`cd server && npm run build && npm start`（或使用 pm2/systemd 运行 `node server/dist/index.js`）。
6. **前端**：设置 `REACT_APP_API_URL` 为生产环境 API 地址后执行 `npm run build`，将 `client/build` 部署到 Nginx 等静态服务。
7. **安全**：生产环境务必修改 `JWT_SECRET`，并按要求配置 SMTP（若需邮件）。

## 数据库字段说明

- 工单表使用 `creator_id`（创建人）、`assignee_id`（指派人），与需求中的 created_by / assigned_to 等价。
- 用户表 `role` 取值为 `user`、`technician`、`admin`（技术员对应 `technician`，与需求中的 `tech` 等价）。

## 测试验证建议

- **普通用户**：登录后仅能看到自己创建的工单；创建工单时勾选「自动分配」或取消后选择技术员，提交后工单应被正确指派；在工单详情页只能查看与评论，无状态/编辑/删除按钮；直接访问他人工单 URL 应返回 403。
- **技术员**：登录后仅能看到指派给自己的工单；可更新状态、添加评论；访问非自己指派的工单 URL 应返回 403。
- **管理员**：可查看全部工单、编辑任意工单（标题、描述、优先级、分类、指派人）、删除工单。
- **自动分配**：不选技术员或选无效 ID 时，新工单应指派给当前未完成工单数最少的技术员；若系统中无技术员，指派人应为空。

## 许可证

MIT
