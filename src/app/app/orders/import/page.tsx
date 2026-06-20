import Link from "next/link";
import { importPlatformOptions } from "@/lib/order-import";

export default function ImportOrdersPage() {
  return <main className="max-w-3xl">
    <h1 className="text-2xl font-bold text-ink">平台订单导入</h1>
    <p className="mt-1 text-sm text-muted">支持通用模板、拼多多、淘宝、Shopify 与 Etsy 导出文件，导入后自动计算订单利润。</p>
    <form action="/api/orders/import" method="post" encType="multipart/form-data" className="mt-6 space-y-5 rounded-xl border bg-white p-6 shadow-soft">
      <label className="block text-sm font-medium">订单平台
        <select name="platform" required defaultValue="GENERIC" className="mt-1 block w-full rounded-lg border px-3 py-2.5">
          {importPlatformOptions.map(option => <option key={option.value} value={option.value}>{option.label} · {option.description}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">订单文件
        <input name="file" type="file" accept=".csv,.xlsx" required className="mt-1 block w-full rounded-lg border px-3 py-2.5" />
      </label>
      <div className="rounded-lg bg-panel p-4 text-sm text-muted">
        <p className="font-semibold text-ink">匹配规则</p>
        <p className="mt-2">系统会自动识别各平台常见字段。订单号和 SKU 编码为必需字段；拼多多商家编码为空时，会使用样式 ID 自动建立产品和 SKU。</p>
        <p className="mt-2">同一订单的多条商品记录会合并为一个订单；已存在的订单号自动跳过；单次最多导入 2000 行。</p>
      </div>
      <div className="flex gap-3 border-t pt-5">
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">开始导入</button>
        <Link href="/app/orders" className="rounded-lg border px-4 py-2 text-sm font-semibold text-muted">取消</Link>
      </div>
    </form>
  </main>;
}
