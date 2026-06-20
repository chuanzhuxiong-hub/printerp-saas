# PrintERP

PrintERP 是面向 3D 打印电商商家的多租户 SaaS ERP。当前版本覆盖产品 / SKU / BOM、采购入库、库存流水、订单导入、生产、发货、售后、利润核算、AI 电商增长、竞品监控、后台任务、平台管理员和商业化部署基础。

## 本地开发

1. 复制环境变量：

```powershell
Copy-Item .env.example .env
```

2. 启动 PostgreSQL：

```powershell
docker compose up -d postgres
```

3. 安装依赖并初始化数据库：

```powershell
npm install
npx prisma migrate dev
npm run db:seed
```

4. 启动开发服务：

```powershell
npm run dev
```

默认访问地址：`http://localhost:3000/app/login`

测试账号通常为：

```text
owner@printerp.test
password123
```

## 关键环境变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | Prisma 使用的 PostgreSQL 连接串。 |
| `AUTH_SECRET` | 登录会话签名密钥，生产环境必须使用至少 32 位随机值。 |
| `APP_URL` | 应用外部访问地址，生产环境必须使用 HTTPS。 |
| `APP_TIMEZONE` | 业务默认时区，中国商家建议 `Asia/Shanghai`。 |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Docker PostgreSQL 初始化参数。 |
| `APP_PORT` | 宿主机映射端口，默认 `3000`。 |
| `JOB_UPLOAD_DIR` | 后台导入任务保存上传文件的目录，生产环境必须持久化。 |
| `BACKUP_RETENTION_DAYS` | 备份保留天数。 |

## 生产部署：Docker Compose

推荐在云服务器上使用 `docker-compose.prod.yml` 部署。

1. 拉取代码：

```bash
git clone https://github.com/chuanzhuxiong-hub/printerp-saas.git
cd printerp-saas
```

2. 创建生产环境变量：

```bash
cp .env.example .env
```

必须修改：

```text
POSTGRES_PASSWORD=强密码
AUTH_SECRET=至少32位随机字符串
APP_URL=https://你的域名
APP_PORT=3000
JOB_UPLOAD_DIR=/data/job-uploads
```

3. 构建并启动：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

4. 查看状态：

```bash
docker compose -f docker-compose.prod.yml ps
```

5. 查看日志：

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f worker
```

生产 compose 包含：

- `postgres`：PostgreSQL 数据库，使用 Docker volume 持久化。
- `migrate`：启动时执行 `prisma migrate deploy`。
- `app`：Next.js SaaS 应用。
- `worker`：后台任务 worker，用于处理订单导入、费用导入等任务。
- `job_uploads`：后台导入任务上传文件持久卷。

## 数据库迁移

开发环境：

```powershell
npm run prisma:migrate
```

生产环境：

```bash
npm run prisma:deploy
```

Docker 生产部署会通过 `migrate` 服务自动执行迁移。

## 备份与恢复

创建备份：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1 -OutputDirectory .\backups -RetentionDays 30
```

恢复备份前必须非常谨慎。恢复到默认生产库需要确认短语：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore.ps1 -BackupFile .\backups\printerp-xxxx.dump -Confirmation "RESTORE printerp"
```

建议生产环境：

- 每天自动备份 PostgreSQL。
- 定期做恢复演练。
- 备份同步到对象存储或异地服务器。
- 不要只依赖服务器本机磁盘。

## 上传与导入限制

上传入口统一经过 `src/lib/upload.ts` 校验：

| 场景 | 限制 |
| --- | --- |
| 平台订单导入 | 10 MB，支持 `.csv` / `.xlsx`。 |
| 费用导入 | 10 MB，支持 `.csv` / `.xlsx`。 |
| 产品中心竞品 / 选品池导入 | 5 MB，支持 `.csv`。 |
| G-code 分析 | 20 MB，支持 `.gcode` / `.gc` / `.txt`。 |

生产部署必须持久化 `JOB_UPLOAD_DIR`，否则后台 worker 可能读不到 app 保存的导入文件。

## 安全与运维要求

上线前至少确认：

1. `.env` 不提交到 GitHub。
2. `AUTH_SECRET` 使用强随机值。
3. `APP_URL` 是 HTTPS 域名。
4. 数据库密码不是默认值。
5. 反向代理启用 HTTPS。
6. PostgreSQL 数据卷已持久化并定期备份。
7. `worker` 服务正在运行。
8. 上传文件大小和扩展名限制已开启。
9. API 鉴权和 tenantId 隔离测试通过。
10. 生产环境不要执行演示 seed 数据，除非是全新试用环境。

## 常用测试

```powershell
npm run build
npm run test:readiness
npm run test:security-audit
npm run test:security-isolation
npm run test:upload-limits
npm run test:background-jobs
npm run test:import-jobs
npm run test:performance-foundation
npm run test:ui-foundation
```

完整脚本列表见 `package.json`。

## GitHub 上传

当前仓库地址：

```text
https://github.com/chuanzhuxiong-hub/printerp-saas
```

常用提交流程：

```powershell
git add .
git commit -m "描述这次修改"
git push
```

注意：本地订单导出、`.env`、构建产物、备份文件已通过 `.gitignore` 排除，不应上传到 GitHub。
