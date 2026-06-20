export type NavigationItem = {
  label: string;
  href: string;
  roles?: string[];
  helpKey: string;
  description?: string;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

const ownerManager = ["OWNER", "MANAGER"];
const finance = ["OWNER", "MANAGER", "FINANCE"];
const warehouse = ["OWNER", "MANAGER", "WAREHOUSE"];
const production = ["OWNER", "MANAGER", "PRODUCTION"];
const support = ["OWNER", "MANAGER", "SUPPORT"];

export const navigationGroups: NavigationGroup[] = [
  {
    title: "主菜单",
    items: [
      { label: "首页", href: "/app/dashboard", roles: finance, helpKey: "dashboard", description: "经营驾驶舱" },
      { label: "产品中心", href: "/app/products", roles: production, helpKey: "products", description: "SPU、SKU、模型、BOM、AI 与竞品" },
      { label: "订单中心", href: "/app/orders", roles: support, helpKey: "orders", description: "订单、生产、发货、售后和利润" },
      { label: "生产中心", href: "/app/production", roles: production, helpKey: "production", description: "生产任务、打印机和失败记录" },
      { label: "库存中心", href: "/app/inventory", roles: warehouse, helpKey: "inventory", description: "耗材、成品、包装和库存流水" },
      { label: "采购中心", href: "/app/purchases", roles: warehouse, helpKey: "purchases", description: "采购、入库批次和供应商成本" },
      { label: "数据导入", href: "/app/orders/import", roles: support, helpKey: "order-import", description: "平台订单与账单导入" },
      { label: "报表中心", href: "/app/reports/profit", roles: finance, helpKey: "profit-report", description: "利润、SKU、店铺和效率分析" },
      { label: "帮助中心", href: "/app/help", helpKey: "help", description: "新手教程、初始化向导和 FAQ" },
      { label: "系统设置", href: "/app/settings/shops", roles: ownerManager, helpKey: "shops", description: "店铺、员工、供应商和基础资料" }
    ]
  }
];

export function canAccessNavigation(item: NavigationItem, role: string) {
  return !item.roles || item.roles.includes(role);
}
