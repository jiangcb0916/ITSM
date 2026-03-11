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
psql -d itsm -f server/scripts/migratesms-deleted-by-user.sql
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

看到 `ITSM server running at http://localhost:3011` 即表示后端就绪。

**终端二 - 前端：**

```bash
cd client
npm start
```

浏览器会打开开发服务器（`http://localhost:3010`，与生产端口一致）。前端会**直接请求** `http://localhost:3011/api`（与 `client/package.json` 的 proxy 及代码默认端口一致）；若后端端口或域名不同，可设置：

```bash
export REACT_APP_API_URL=http://你的后端地址/api
npm start
```

**端口说明**：后端 **3011**，前端统一为 **3010**（开发 `npm start` 与生产 `serve -l 3010` 均为 3010，见 `client/.env.development` 与 CentOS 8 部署）。

### 6. 首次使用与创建管理员

- **无默认账号**。注册页面仅用于创建**普通用户**（技术人员、管理员需由管理员在「用户管理」中分配）。
- **创建初始管理员**：系统首次部署后没有任何管理员，需在**服务器**上执行脚本创建第一个管理员（在 `server` 目录下）：
  ```bash
  cd server
  npm run create-admin -- -e admin@example.com -p 你的密码
  ```
  将 `admin@example.com` 和 `你的密码` 替换为实际邮箱和至少 6 位的密码。若数据库中已存在管理员，脚本会提示「管理员账号已存在」并退出；否则会创建该管理员账号。
- 打开前端 →「没有账号？去注册」→ 填写邮箱、密码（至少 6 位）、姓名 → 提交后以**普通用户**身份登录。管理员登录后可在「用户管理」中将用户提升为技术人员或管理员。

登录后：

- **普通用户**：创建工单（可手动选择技术员或勾选「自动分配」）、仅查看自己创建的工单、在工单详情中只读+评论与上传附件，不能编辑工单；可将工单从自己的列表中「删除」（仅对自己隐藏，管理员和技术员仍可见）。
- **技术人员**：仅查看指派给自己的工单，在工单详情中更新状态、添加评论（含内部备注）。
- **管理员**：查看全部工单、在工单详情中编辑所有字段、重新指派技术员、删除工单；在「用户管理」中管理用户。

### 管理员密码重置与修改

- **修改其他用户密码**：管理员登录后进入「用户管理」→ 找到对应用户 → 点击「编辑」→ 在「重置密码」中填写新密码（至少 6 位）→ 保存。留空表示不修改密码。
- **修改自己的密码**：管理员在「用户管理」中找到自己（当前登录账号），点击「编辑」，在「重置密码」中填写新密码后保存即可。（管理员不能修改其他管理员的角色/状态，但可以修改自己的密码、姓名、邮箱。）
- **忘记管理员密码且无法登录**：只能在服务器上通过数据库重置。在服务器上执行（将 `新密码` 替换为至少 6 位的密码，`admin@example.com` 替换为管理员邮箱）：
  ```bash
  # 用 Node 生成 bcrypt 哈希（在 /opt/itsm/server 下执行）
  node -e "const bcrypt=require('bcryptjs');console.log(bcrypt.hashSync('新密码',10));"
  ```
  复制输出的哈希，然后：
  ```bash
  sudo -u postgres psql -d itsm -c "UPDATE users SET password_hash='这里粘贴上面的哈希' WHERE email='admin@example.com';"
  ```
  保存后该管理员即可用新密码登录。

- **删除唯一管理员并重新创建首位管理员**：系统不允许在页面上删除最后一名管理员。若确需“清空管理员、再建一个”，只能在服务器上通过数据库操作，再运行创建脚本。
  1. **删除唯一管理员**（二选一）：
     - **方式 A：软删除**（该账号无法再登录，与在「用户管理」中删除效果一致）  
       将下面命令中的 `管理员邮箱` 换成要删除的管理员邮箱；Mac 本地若用当前用户连库，可用 `psql -d itsm -c "..."`，Linux 上常用 `sudo -u postgres psql -d itsm -c "..."`。
       ```bash
       psql -d itsm -c "UPDATE users SET deleted_at = CURRENT_TIMESTAMP, status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE email = '管理员邮箱' AND role = 'admin';"
       ```
     - **方式 B：仅取消管理员身份**（保留账号为普通用户，可继续登录）  
       ```bash
       psql -d itsm -c "UPDATE users SET role = 'user', updated_at = CURRENT_TIMESTAMP WHERE email = '管理员邮箱' AND role = 'admin';"
       ```
  2. **重新创建首位管理员**（在项目 `server` 目录下执行，将邮箱和密码换成实际值）：
     ```bash
     cd server
     npm run create-admin -- -e 新管理员邮箱 -p 新密码
     ```
     执行成功后，即可使用新邮箱和新密码以管理员身份登录。

## 常见问题

| 现象 | 处理 |
|------|------|
| 注册/登录 404 | 确认后端已启动在 **3011**，前端请求地址为 `http://localhost:3011/api`（见 `client/src/api/index.ts`）。 |
| 431 Request Header Fields Too Large | 后端已提高请求头限制；若仍出现，可清理浏览器对 localhost 的 Cookie 后重试。 |
| 注册失败 / 网络错误 | 确认后端 `npm run dev` 无报错，且能访问 `http://localhost:3011`。 |
| createdb / psql 找不到 | 安装 PostgreSQL 并将 `bin` 加入 PATH（如 `export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"`）。 |

## API 概览

- `GET /` — 接口说明（非 404）
- `POST /api/auth/register` — 注册（仅创建普通用户，body: email, password, name；技术人员/管理员由管理员在用户管理中分配）
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
# 后端（默认端口 3011）
cd server && npm run build && npm start

# 前端（需先设置 REACT_APP_API_URL 为生产 API 地址，如 http://服务器IP:3011/api）
cd client && npm run build
# 将 build 目录用静态服务（如 serve -l 3010）或 Nginx 提供，并配置 API 代理到后端
```

---

## 在 CentOS 8 上部署（systemctl 管理前后端）

以下步骤在 CentOS 8 服务器上完成：**代码从 GitHub 直接拉取**到 `/opt/itsm`，**前后端均使用 systemd 管理**，后端端口 **3011**，前端静态服务端口 **3010**。

### 端口与访问地址

| 服务       | 端口  | 说明 |
|------------|-------|------|
| 后端 API   | 3011  | 接口根地址：`http://服务器IP:3011/api` |
| 前端页面   | 3010  | 浏览器访问：`http://服务器IP:3010` |

### 1. 环境准备

- 以 root 登录。
- 安装 Git、Node.js、PostgreSQL（若数据库在本机）。

**安装 Node.js 18（NodeSource）：**

```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
dnf install -y nodejs
node -v   # 应显示 v18.x
```

**安装 PostgreSQL（可选，若本机建库）：**

```bash
dnf install -y postgresql-server postgresql
postgresql-setup --initdb
systemctl enable postgresql && systemctl start postgresql
```

### 2. 从 GitHub 拉取代码（直接克隆到服务器）

在服务器上以 root 执行，将仓库**直接克隆到** `/opt/itsm`：

```bash
# 安装 Git（若未安装）
dnf install -y git

# 从 GitHub 克隆项目（仓库包含 client/、server/、README.md）
git clone -b main https://github.com/jiangcb0916/ITSM.git /opt/itsm

# 确认目录结构
ls /opt/itsm
# 应看到：client  server  README.md 等
ls /opt/itsm/server
# 应看到：package.json  scripts  src 等
```

- 仓库地址：**https://github.com/jiangcb0916/ITSM.git**
- 默认分支：**main**（若你的默认分支是 `master`，把上面 `-b main` 改为 `-b master`）
- 克隆后 `/opt/itsm` 下即有 `client/`、`server/`，无需再上传代码；后续步骤均在该目录下进行。

### 3. 创建数据库

```bash
# 若 PostgreSQL 在本机，创建数据库并执行建表脚本（脚本路径为克隆后的实际路径）
sudo -u postgres createuser -s itsm   # 或使用已有用户，如 postgres
sudo -u postgres createdb itsm
sudo -u postgres psql -d itsm -f /opt/itsm/server/scripts/init.sql
```

如需执行迁移脚本（用户管理、软删除等），同上方式执行 `server/scripts/` 下对应 `.sql`，例如：

```bash
sudo -u postgres psql -d itsm -f /opt/itsm/server/scripts/migrate-users-management.sql
```

### 3.1 PostgreSQL 认证配置（避免「Ident 认证失败」）

后端通过 TCP（127.0.0.1）连接数据库时，若 PostgreSQL 使用 **Ident** 认证，会报错「用户 postgres Ident 认证失败」。需改为**密码认证（md5）**并设置密码。

**① 为 postgres 用户设置密码**

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '你的密码';"
```

（执行时若出现 `could not change directory to "/root": 权限不够`，可忽略，只要看到 `ALTER ROLE` 即表示成功。）

**② 修改 pg_hba.conf：本机 TCP 连接改用 md5**

查看配置文件路径：

```bash
sudo -u postgres psql -c "SHOW hba_file;"
```

常见路径为 `/var/lib/pgsql/data/pg_hba.conf`。编辑该文件：

```bash
sudo vi /var/lib/pgsql/data/pg_hba.conf
```

找到并修改以下两行，将末尾的 **ident** 改为 **md5**（其余行保持不变）：

```text
# 改前
host    all             all             127.0.0.1/32            ident
host    all             all             ::1/128                 ident

# 改后
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

保存后重载 PostgreSQL：

```bash
sudo systemctl reload postgresql
```

**③ 在 server/.env 中配置数据库密码**

后端 `server/.env` 中的 `DB_PASSWORD` 必须与上面为 postgres 设置的密码一致，例如：

```env
DB_USER=postgres
DB_PASSWORD=你的密码
```

否则后端连接数据库仍会失败。

### 4. 后端配置与构建

```bash
cd /opt/itsm/server
cp .env.example .env
# 编辑 .env：PORT=3011，以及 DB_HOST、DB_NAME、DB_USER、DB_PASSWORD、JWT_SECRET 等
vi .env

# 必须完整安装（含 devDependencies），否则 tsc 不存在会报错
npm install
npm run build
# 可选：构建完成后删除开发依赖以节省空间
# npm prune --omit=dev
```

建议上传目录使用绝对路径，例如：

```bash
mkdir -p /var/lib/itsm/uploads
# 在 .env 中设置 UPLOAD_DIR=/var/lib/itsm/uploads
```

**首次部署时创建初始管理员**（数据库已建好、`.env` 已配置后执行）：

```bash
cd /opt/itsm/server
npm run create-admin -- -e admin@example.com -p 你的密码
```

将邮箱和密码替换为实际值；若已存在管理员，脚本会提示并退出。

### 5. 前端配置与构建

```bash
cd /opt/itsm/client
# 生产 API 地址（替换为实际服务器 IP 或域名）
echo "REACT_APP_API_URL=http://172.16.80.132:3011/api" > .env.production
npm install
npm install serve --save-dev   # 用于 systemd 提供静态服务
npm run build
```

### 6. systemd 服务文件

端口已在代码中固定（后端 3011、前端 3010），直接在 unit 里写即可，无需单独环境文件。

**后端**：创建 `/etc/systemd/system/itsm-backend.service`：

```ini
[Unit]
Description=IT Ticket System Backend (Node.js)
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/itsm/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itsm-backend
Environment=PORT=3011
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**前端**：创建 `/etc/systemd/system/itsm-frontend.service`：

```ini
[Unit]
Description=IT Ticket System Frontend (Static serve)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/itsm/client
ExecStart=/usr/bin/npx --yes serve -s build -l 3010
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itsm-frontend
Environment=PATH=/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
```

若部署路径不是 `/opt/itsm`，请将上述 `WorkingDirectory` 和路径改为实际目录。

### 7. 启动并设置开机自启

```bash
sudo systemctl daemon-reload
sudo systemctl enable itsm-backend itsm-frontend
sudo systemctl start itsm-backend itsm-frontend
sudo systemctl status itsm-backend itsm-frontend
```

### 8. 防火墙放行端口（若启用 firewalld）

```bash
sudo firewall-cmd --permanent --add-port=3010/tcp
sudo firewall-cmd --permanent --add-port=3011/tcp
sudo firewall-cmd --reload
```

### 9. 常用 systemctl 命令

```bash
# 查看状态
sudo systemctl status itsm-backend itsm-frontend

# 重启
sudo systemctl restart itsm-backend itsm-frontend

# 查看日志
sudo journalctl -u itsm-backend -f
sudo journalctl -u itsm-frontend -f
```

### 10. 后续升级

从 GitHub 拉取最新代码后，重新构建并重启服务即可：

```bash
cd /opt/itsm
git pull origin main   # 从 GitHub 拉取最新代码（分支为 main 时）

cd /opt/itsm/server && npm install && npm run build
cd /opt/itsm/client && npm install && npm run build

sudo systemctl restart itsm-backend itsm-frontend
```

### 11. 安全与其它

- 生产环境务必修改 `JWT_SECRET` 和数据库密码；服务器登录密码建议修改（示例中为 `root`/`Admin@123`）。
- 若需邮件通知，在 `server/.env` 中配置 SMTP 相关变量。

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
