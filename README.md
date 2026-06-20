# PrintERP

PrintERP 是面向 3D 打印电商卖家的多租户 SaaS ERP。当前版本覆盖商品/SKU/BOM、采购入库、库存流水、订单导入、生产、售后、利润核算、产品增长、竞品监控、后台任务、平台管理和商业化部署基础。

## 本地开发

1. 复制环境变量：

```powershell
Copy-Item .env.example .env
```

2. 启动数据库：

```powershell
docker compose up -d db
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

默认访问地址为 `http://localhost:3000`。

## 关键环境变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | Prisma 使用的 PostgreSQL 连接串 |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Docker PostgreSQL 初始化参数 |
| `APP_URL` | 应用外部访问地址，本地通常为 `http://localhost:3000` |
| `SESSION_SECRET` | 登录会话签名密钥，生产环境必须使用强随机值 |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | 平台超级管理员初始化账号 |
| `APP_TIMEZONE` | 业务默认时区，建议中国商家使用 `Asia/Shanghai` |
| `BACKUP_DIR` | 数据库备份输出目录 |
| `BACKUP_RETENTION_DAYS` | 备份保留天数 |

## Docker 部署

本地完整启动：

```powershell
docker compose up -d --build
```

查看健康状态：

```powershell
docker compose ps
```

生产部署建议：

1. 使用独立的 `.env`，不要提交真实密钥。
2. 将 `SESSION_SECRET`、数据库密码、超级管理员密码换成强随机值。
3. 通过反向代理提供 HTTPS。
4. 固定 PostgreSQL 数据卷，并定期执行备份恢复演练。
5. 后台任务建议单独运行 worker：

```powershell
npm run jobs:work -- --limit=10
```

## 数据库迁移与种子数据

生成 Prisma Client：

```powershell
npm run prisma:generate
```

开发迁移：

```powershell
npm run prisma:migrate
```

初始化演示数据：

```powershell
npm run db:seed
```

发布前应确认迁移可以在空库和已有数据的库上稳定执行。

## 上传限制

上传入口统一经过 `src/lib/upload.ts` 校验：

| 场景 | 限制 |
| --- | --- |
| 平台订单导入 | 10 MB，支持 `.csv` / `.xlsx` |
| 费用导入 | 10 MB，支持 `.csv` / `.xlsx` |
| 产品中心竞品/选品池导入 | 5 MB，支持 `.csv` |
| G-code 分析 | 20 MB，支持 `.gcode` / `.gc` / `.txt` |

## 日志与监控

应用内提供 `src/lib/logger.ts` 结构化错误日志工具，输出 JSON，包含错误名称、消息、堆栈、时间戳和调用方传入的业务上下文。

生产环境建议接入至少一种集中化方案：

- Sentry：追踪前后端异常和发布版本。
- OpenTelemetry：统一请求链路、任务耗时和数据库调用。
- Loki / ELK：集中收集 Docker 日志，便于按租户、用户、业务动作检索。

## 备份与恢复

备份、恢复与恢复演练脚本位于 `scripts/`，发布前建议至少执行一次恢复演练：

```powershell
npm run test:readiness
```

如果生产数据量增长，应把备份上传到对象存储，并配置异地保留策略。

## 常用测试

```powershell
npm run build
npm run test:readiness
npm run test:security-audit
npm run test:security-isolation
npm run test:upload-limits
npm run test:background-jobs
npm run test:performance-foundation
```

订单、库存、采购、售后、产品增长等业务脚本可按需单独执行，完整脚本列表见 `package.json`。

## 发布检查

发布前至少确认：

1. `npm run build` 通过。
2. 数据库迁移在目标环境可执行。
3. seed 数据不会污染生产租户。
4. 上传入口存在大小和扩展名限制。
5. API 已鉴权并带租户隔离。
6. 备份、恢复、日志、健康检查可用。
7. 后台任务 worker 已配置独立运行和重启策略。
