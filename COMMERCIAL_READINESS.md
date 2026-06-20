# PrintERP 第一版商用验收清单

本文档以 `PrintERP_Commercial_PRD_Optimized_v2.md` 第一阶段范围为验收基准。第二、第三阶段的外部 API、定时竞品采集、真实 AI 图片生成和自动发布不属于第一版阻断项。

## 自动验收

运行完整商用验收：

```powershell
npm run test:acceptance
```

该命令覆盖：

- 生产构建与数据库迁移兼容性
- 健康检查、安全响应头和生产 Compose 隔离
- 角色权限、多租户会话失效和数据初始化安全
- 订单、采购、库存、生产、成本、产品增长和竞品监控核心流程
- 内容审核、选品池批量操作与 5 个竞品上限
- 并发性能门槛
- 数据库备份与临时数据库恢复演练
- 生产依赖安全门槛：高危和严重漏洞必须为零；中等级告警记录并跟踪上游修复

## 上线前人工配置

- [ ] 将 `APP_URL` 设置为正式 HTTPS 域名
- [ ] 使用密码管理器生成至少 32 位随机 `AUTH_SECRET`
- [ ] 设置独立强数据库密码，且 PostgreSQL 不暴露公网
- [ ] 删除演示数据或修改演示账号密码
- [ ] 核对员工角色和最小权限
- [ ] 配置反向代理、HTTPS 证书与 `/api/health` 监控
- [ ] 安装备份计划任务，并将备份镜像复制到独立存储
- [ ] 根据运营地区发布隐私政策、服务条款和数据保留规则

## 备份与恢复

手工备份：

```powershell
.\scripts\backup.ps1 -MirrorDirectory "D:\PrintERP-Offsite"
```

安装每日备份计划：

```powershell
.\scripts\install-backup-task.ps1 -Time "02:00" -MirrorDirectory "D:\PrintERP-Offsite"
```

无损恢复演练：

```powershell
.\scripts\backup-restore-test.ps1
```

恢复正式数据库需要显式确认：

```powershell
.\scripts\restore.ps1 -BackupFile .\backups\printerp-YYYYMMDD-HHMMSS.dump -Confirmation "RESTORE printerp"
```

## 发布流程

```powershell
.\scripts\backup.ps1
docker compose -f docker-compose.prod.yml up -d --build
npm run test:acceptance
```
