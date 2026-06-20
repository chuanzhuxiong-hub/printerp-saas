# 平台管理员隔离与 PostgreSQL RLS 设计

## 目标

为 PrintERP 建立与商家后台完全独立的平台管理员后台，并通过 PostgreSQL 行级安全策略为核心业务数据增加数据库级租户隔离。

平台管理员可在填写维护原因后进入指定商家空间，临时获得 30 分钟老板级权限。所有操作必须保留真实管理员身份和完整审计记录。

## 范围

本设计包含：

- 独立平台管理员账号、会话、登录入口和后台路由
- 超级管理员与普通平台管理员权限隔离
- 平台管理员临时进入商家空间的授权机制
- 平台维护模式提示、过期和撤销机制
- 平台级与商家级维护审计
- 核心业务表的 PostgreSQL RLS
- 应用数据库账号与迁移管理账号分离
- 自动化安全回归

本设计暂不包含：

- 商家老板审批平台维护请求
- 自定义授权时长
- 普通管理员创建超级管理员
- 永久平台管理员商家权限
- 全部租户表一次性启用 RLS

## 身份与权限模型

### 平台管理员

平台管理员不再使用 `TenantUser`，也不能拥有商家成员身份。

新增两级平台角色：

- `SUPER_ADMIN`：管理普通平台管理员、进入商家空间、查看平台审计与系统状态
- `ADMIN`：进入商家空间、查看平台审计与系统状态，但不能管理平台管理员

首个超级管理员通过服务器初始化命令创建。后续普通管理员由超级管理员在平台后台创建、停用和重置密码。

平台管理员账号停用后，所有平台会话和临时商家授权立即失效。

### 商家维护授权

平台管理员进入商家前必须填写非空维护原因。

系统创建一条有效期固定为 30 分钟的临时授权。授权期间，管理员在目标商家空间内拥有等同 `OWNER` 的业务权限，但系统始终保留真实平台管理员身份，不伪装为任何商家用户。

授权满足以下规则：

- 每条授权仅对应一个平台管理员和一个商家
- 授权不能续期；需要继续维护时必须重新填写原因并创建新授权
- 管理员主动退出、账号停用、商家停用或授权到期后立即失效
- 管理员只能同时使用一个商家维护授权
- 平台维护会话不能访问其他商家数据

## 会话与路由隔离

平台后台使用独立 Cookie `printerp_admin_session`，商家后台继续使用 `printerp_session`。

路由边界：

- `/admin/login`：平台管理员登录
- `/admin/*`：仅接受平台管理员会话
- `/app/*`：接受商家会话，或接受带有效临时授权的平台维护会话
- `/api/admin/*`：仅接受平台管理员会话
- `/api/*`：接受商家会话，或接受带有效临时授权的平台维护会话

平台管理员会话本身不包含商家权限。只有有效 `TenantAccessGrant` 才能生成平台维护上下文。

平台维护上下文对现有业务权限层暴露 `OWNER` 角色，同时额外携带：

- `actorType = PLATFORM_ADMIN`
- `platformAdminId`
- `accessGrantId`
- `maintenanceReason`
- `tenantId`
- `expiresAt`

商家页面在平台维护模式下持续显示醒目提示、维护原因和剩余时间。

## 数据模型

### PlatformAdmin

- `id`
- `email`，全局唯一
- `name`
- `passwordHash`
- `role`：`SUPER_ADMIN` 或 `ADMIN`
- `status`：`ACTIVE` 或 `DISABLED`
- `createdByAdminId`
- `createdAt`
- `updatedAt`
- `lastLoginAt`

### PlatformAdminSession

- `id`
- `platformAdminId`
- `tokenHash`
- `ipAddress`
- `userAgent`
- `expiresAt`
- `revokedAt`
- `createdAt`

数据库仅保存会话令牌哈希。退出和停用账号时撤销对应会话。

### TenantAccessGrant

- `id`
- `platformAdminId`
- `tenantId`
- `reason`
- `ipAddress`
- `expiresAt`
- `revokedAt`
- `createdAt`

### PlatformAuditLog

- `id`
- `platformAdminId`
- `tenantId`
- `accessGrantId`
- `action`
- `requestMethod`
- `requestPath`
- `entityType`
- `entityId`
- `metadata`
- `ipAddress`
- `createdAt`

平台审计日志不可通过应用后台删除或修改。

## 管理员后台

第一版平台后台包含：

- 平台登录与退出
- 商家列表、状态和基础信息
- 创建维护授权并进入商家空间
- 查看当前和历史维护授权
- 查看平台审计日志
- 查看应用与数据库健康状态
- 超级管理员管理普通管理员账号

普通管理员访问管理员管理页面或接口时返回 `403`。

## 审计规则

平台管理员所有平台后台写操作必须写入 `PlatformAuditLog`。

使用临时商家授权执行的业务操作必须同时：

- 写入现有商家 `AuditLog`
- 写入不可变的 `PlatformAuditLog`
- 在日志中记录平台管理员、商家、授权、维护原因、请求路径和业务实体

登录、登录失败、创建授权、进入商家、退出商家、授权到期、撤销授权、管理员创建、停用和密码重置均需审计。

审计日志只记录必要修改摘要，不记录密码、会话令牌或完整敏感请求内容。

## PostgreSQL RLS

### 数据库账号分离

生产环境使用两个数据库账号：

- 应用账号：运行 Web 应用，不能绕过 RLS，不能修改策略
- 管理账号：仅用于 Prisma 迁移、种子、数据修复和受控维护

应用账号不能成为表所有者，也不能拥有 `BYPASSRLS`。

### 租户上下文

受 RLS 保护的业务查询必须在事务内设置：

```sql
SET LOCAL app.tenant_id = '<tenant-id>';
```

策略使用：

```sql
"tenantId" = current_setting('app.tenant_id', true)
```

缺少租户上下文时，核心业务表默认返回零行并拒绝新增、修改和删除。

平台维护模式同样设置目标商家的 `tenantId`，不会绕过 RLS。

### 首批保护表

首批覆盖最敏感且具有完整 `tenantId` 的核心业务表：

- `Product`
- `ProductSku`
- `SalesOrder`
- `SalesOrderItem`
- `AfterSale`
- `AfterSaleItem`
- `PurchaseOrder`
- `PurchaseOrderItem`
- `InventoryItem`
- `InventoryTransaction`
- `CostRecord`
- `Expense`
- `ProfitSnapshot`
- `DailyProfitReport`
- `MonthlyProfitReport`

每张表启用并强制 RLS，建立统一的租户读取与写入策略。

稳定运行并完成回归后，再扩展到其余租户业务表。

### Prisma 接入

新增租户数据库执行器，所有受保护业务代码通过它运行：

```ts
withTenantDb(tenantId, async (tx) => {
  // 所有受 RLS 保护的查询和写入
});
```

执行器创建 Prisma 事务，先设置 `SET LOCAL app.tenant_id`，再执行回调。租户 ID 只来源于已验证的商家会话或有效平台维护授权。

直接使用全局 `db` 访问受保护表将因缺少租户上下文而失败或返回零行。

## 错误处理

- 无平台会话访问 `/admin/*`：重定向到 `/admin/login`
- 普通管理员访问超级管理员功能：返回 `403`
- 未填写维护原因：返回 `400`
- 无效、撤销或过期维护授权：清除维护状态并重定向到 `/admin/tenants`
- 平台管理员停用：撤销全部会话和授权
- RLS 缺少租户上下文：拒绝写入，不回退到无隔离查询
- 跨商家 ID 查询：返回不存在或拒绝访问，不泄露目标是否存在

## 测试与验收

### 平台管理员隔离

- 商家 Cookie 不能访问 `/admin`
- 平台管理员 Cookie 不能在没有授权时访问 `/app`
- 普通管理员不能创建、停用或重置管理员
- 超级管理员可以管理普通管理员
- 平台管理员不能成为 `TenantUser`

### 临时商家授权

- 原因为空时不能创建授权
- 授权创建后 30 分钟内可进入目标商家
- 授权不能访问其他商家
- 授权过期、撤销或管理员停用后立即失效
- 维护操作同时产生商家审计和平台审计

### RLS

- 缺少 `app.tenant_id` 时无法读取或写入核心业务表
- 租户 A 上下文无法读取、修改或删除租户 B 数据
- 租户 A 无法写入带租户 B `tenantId` 的记录
- 有效平台维护授权只能访问其目标商家
- 管理账号可执行迁移和受控维护

### 回归

- 现有商家登录、角色权限、订单、采购、库存、售后、利润和产品流程保持可用
- 所有现有安全测试继续通过
- Docker 开发与生产部署均通过健康检查

## 上线顺序

1. 建立独立平台管理员数据模型和会话
2. 建立 `/admin` 后台和管理员管理权限
3. 建立临时商家授权与维护模式
4. 完善平台与商家双审计
5. 创建应用数据库账号和 RLS 迁移
6. 将首批核心业务代码迁移到租户数据库执行器
7. 运行完整安全、业务和部署回归
8. 观察稳定性后扩展 RLS 到全部租户业务表

## 安全结论

平台管理员拥有高风险维护能力，因此必须与商家身份完全隔离，并依赖短时授权、不可变审计和数据库 RLS 三层共同约束。

平台维护权限等同商家老板，但不等于商家老板身份。任何维护操作都必须能够追溯到真实平台管理员及其填写的维护原因。
