# PrintERP 使用帮助维护规范

使用帮助是产品功能的一部分，任何影响客户操作方式的功能更新都必须同步更新教程。

## 内容位置

- 菜单定义：`src/lib/navigation.ts`
- 帮助主题：`src/lib/help-content.ts`
- 帮助中心页面：`src/app/app/help/page.tsx`
- 同步覆盖率测试：`scripts/help-coverage-test.ts`

## 新增功能时

1. 在 `src/lib/navigation.ts` 添加菜单项，并设置唯一 `helpKey`。
2. 在 `src/lib/help-content.ts` 添加相同 `key` 的帮助主题。
3. 教程至少包含功能说明、操作步骤、适用角色和注意事项。
4. 若功能不应直接显示在菜单中，也应在最相关的主题中补充说明。
5. 运行帮助覆盖率测试和生产构建。

```powershell
npm run test:help
npm run test:smoke
npm run build
```

菜单缺少对应帮助主题、帮助主题键重复、或帮助主题指向不存在的页面时，`npm run test:help` 会失败。

## 修改功能时

以下变化必须同步修改对应帮助主题：

- 页面入口、按钮名称或操作顺序变化
- 字段含义、计算规则或状态流转变化
- 权限角色变化
- 导入模板或支持格式变化
- 会影响库存、成本、利润或审计记录的业务规则变化

## 发布检查

每次发布前确认：

- `npm run test:help` 通过
- `npm run test:smoke` 能访问 `/app/help`
- 新增或修改功能的教程内容与当前界面一致
- 不同角色只能看到自己有权限使用的功能教程

