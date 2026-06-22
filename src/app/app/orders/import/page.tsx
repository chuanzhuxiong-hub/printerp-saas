import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { importPlatformOptions } from "@/lib/order-import";

const platformCopy: Record<string, { label: string; description: string }> = {
  GENERIC: { label: "通用模板", description: "PrintERP 标准 CSV / Excel 字段" },
  PINDUODUO: { label: "拼多多", description: "拼多多后台订单导出文件" },
  TAOBAO: { label: "淘宝", description: "淘宝后台订单导出文件" },
  SHOPIFY: { label: "Shopify", description: "Shopify Orders CSV" },
  ETSY: { label: "Etsy", description: "Etsy Orders CSV" }
};

export default function ImportOrdersPage() {
  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <PageHeader
        eyebrow="数据导入"
        title="平台订单导入"
        description="支持通用模板、拼多多、淘宝、Shopify 与 Etsy 导出文件。导入后系统会按订单号去重，并根据 SKU 编码关联产品成本和利润。"
      />

      <form action="/api/orders/import" method="post" encType="multipart/form-data" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <label className="block text-sm font-medium text-ink">
          订单平台
          <select name="platform" required defaultValue="GENERIC" className="mt-2 block min-h-11 w-full rounded-lg border px-3 py-2.5 text-sm">
            {importPlatformOptions.map((option) => {
              const copy = platformCopy[option.value] ?? { label: option.label, description: option.description };
              return <option key={option.value} value={option.value}>{copy.label} · {copy.description}</option>;
            })}
          </select>
        </label>

        <label className="block text-sm font-medium text-ink">
          订单文件
          <input name="file" type="file" accept=".csv,.xlsx" required className="mt-2 block min-h-11 w-full rounded-lg border px-3 py-2.5 text-sm" />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p className="font-semibold text-ink">匹配规则</p>
          <p className="mt-2">系统会识别各平台常见字段。订单号和 SKU 编码为必需字段；拼多多商家编码为空时，会尝试使用样式 ID 自动建立产品和 SKU。</p>
          <p className="mt-2">同一订单的多条商品记录会合并为一个订单；已经存在的订单号会自动跳过；单次最多导入 2000 行。</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row">
          <button className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto">开始导入</button>
          <Link href="/app/orders" className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto">取消</Link>
        </div>
      </form>
    </div>
  );
}
