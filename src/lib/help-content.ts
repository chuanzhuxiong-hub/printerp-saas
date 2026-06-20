export type HelpSection = {
  title: string;
  scenario?: string;
  paragraphs?: string[];
  steps?: string[];
  tips?: string[];
  commonMistakes?: string[];
  next?: string[];
};

export type HelpTopic = {
  key: string;
  title: string;
  summary: string;
  route: string;
  audience: string;
  sections: HelpSection[];
};

export const helpCategories = [
  { title: "新手入门", href: "/app/help/getting-started", summary: "第一次使用 PrintERP 的完整 14 步流程。" },
  { title: "初始化设置", href: "/app/help/setup", summary: "店铺、供应商、耗材、打印机和库存警戒线配置。" },
  { title: "产品与 SKU 管理", href: "/app/help/products", summary: "理解 SPU、SKU、模型、BOM 和 AI 内容工作流。" },
  { title: "耗材与采购管理", href: "/app/help/materials", summary: "采购入库、批次、每克成本和供应商价格管理。" },
  { title: "生产与库存管理", href: "/app/help/production", summary: "生产任务、实际耗材、失败成本和库存流水。" },
  { title: "订单与发货管理", href: "/app/help/orders", summary: "订单录入、平台导入、发货、物流成本和利润追踪。" },
  { title: "售后与补发管理", href: "/app/help/after-sales", summary: "退款、补发、破损、错发和售后成本核算。" },
  { title: "利润报表查看", href: "/app/help/reports", summary: "查看订单利润、SKU 利润、店铺利润和 3D 打印成本。" },
  { title: "拼多多数据导入教程", href: "/app/help/pdd-import", summary: "按月核算利润时需要导入的拼多多表格。" },
  { title: "常见问题 FAQ", href: "/app/help/faq", summary: "普通 3D 打印商家最常见的操作疑问。" }
];

export const gettingStartedSteps = [
  { title: "创建商家空间", description: "注册账号后，先创建自己的商家空间。所有店铺、产品、订单、库存和利润数据都会归属于这个商家空间。", href: "/app/register" },
  { title: "添加店铺和销售渠道", description: "进入设置 / 店铺管理，先添加拼多多、淘宝、抖音、线下销售、微信私域等渠道。", href: "/app/settings/shops/new" },
  { title: "添加产品", description: "进入产品中心，先添加产品 SPU，例如 3D 打印多肉花盆、笔筒、摆件、车载配件。", href: "/app/products/new" },
  { title: "添加 SKU", description: "在产品下展开 SKU 管理，添加灰色大号、白色小号、黑色 PETG 款等真实销售规格。SKU 是订单、库存、生产和利润核算的核心对象。", href: "/app/products" },
  { title: "添加耗材资料", description: "进入耗材管理，维护 PLA、PETG、ABS、TPU 等耗材，并记录颜色、品牌、供应商、单位等信息。", href: "/app/settings/materials/new" },
  { title: "添加供应商", description: "维护耗材和包装材料供应商，后续采购时才能记录不同供应商、不同批次、不同价格。", href: "/app/settings/suppliers/new" },
  { title: "录入采购单和耗材批次", description: "采购耗材后，在采购中心录入材质、颜色、重量、采购金额、运费、税费、优惠金额。系统会计算每克成本，并生成耗材批次库存。", href: "/app/purchases/new" },
  { title: "设置产品 BOM / 打印配方", description: "在 SKU 的 BOM 中设置理论耗材克数、预计打印时间、损耗比例、包装材料、人工成本、机器折旧、电费等。", href: "/app/boms/new" },
  { title: "维护成品库存和库存警戒线", description: "为每个 SKU 设置库存警戒线。库存低于警戒线时，系统提醒补货或安排生产。", href: "/app/inventory" },
  { title: "导入或录入订单", description: "可以手工录入订单，也可以导入拼多多订单表。订单需要关联店铺、SKU、售价、优惠、实收金额等数据。", href: "/app/orders/import" },
  { title: "创建生产任务", description: "当订单需要生产时，根据订单 SKU 创建生产任务，记录打印机、实际耗材、实际打印时间、完成数量、失败数量。", href: "/app/production/new" },
  { title: "发货并记录物流成本", description: "订单发货时录入快递公司、运单号、快递费用。系统会扣减成品库存和包装材料库存，并重新计算订单利润。", href: "/app/shipments/new" },
  { title: "处理售后", description: "退款、补发、发错货、产品破损、打印失败等售后，需要在订单详情中新增售后记录，售后成本会影响订单最终利润。", href: "/app/after-sales/new" },
  { title: "查看利润报表", description: "进入首页看板或报表中心，查看今日利润、本周利润、本月利润、SKU 利润排行、店铺利润排行、售后损失和打印机效率。", href: "/app/reports/profit" }
];

function topic(key: string, title: string, summary: string, route: string, sections: HelpSection[], audience = "老板、店长、财务、客服、生产员"): HelpTopic {
  return { key, title, summary, route, audience, sections };
}

function standardTopic(key: string, title: string, summary: string, route: string, steps: string[], tips: string[] = [], commonMistakes: string[] = [], next: string[] = []): HelpTopic {
  return topic(key, title, summary, route, [
    { title: "适用场景", paragraphs: [summary] },
    { title: "操作步骤", steps },
    { title: "注意事项", tips },
    { title: "常见错误", commonMistakes },
    { title: "下一步建议", next }
  ]);
}

const genericTopics: HelpTopic[] = [
  standardTopic("dashboard", "经营看板", "查看销售额、订单数、利润、待生产、待发货、库存预警和竞品提醒。", "/app/dashboard", ["登录后进入首页经营看板。", "先看今日销售额、净利、待生产和待发货数量。", "再看近 7 日销售与利润趋势，判断收入是否带来真实利润。"], ["利润会随发货、广告、售后和成本记录自动变化。"]),
  standardTopic("products", "产品中心", "一体化管理产品、SKU、BOM、模型、AI 标题、主图、详情页、竞品监控和选品池。", "/app/products", ["新增产品 SPU。", "在产品下展开并维护 SKU。", "为 SKU 配置 BOM / 打印配方。", "在产品详情中维护模型、AI 内容、竞品链接和选品机会。"], ["SKU、BOM、模型、AI 和竞品功能都集成在产品中心，不拆成一级菜单。"]),
  standardTopic("orders", "订单中心", "管理手工订单和平台导入订单，并追踪收入、成本、状态和利润。", "/app/orders", ["新建订单或进入平台订单导入。", "选择店铺，填写订单号、客户、下单时间和实收金额。", "添加 SKU 明细并核对售价、优惠和平台费用。", "在订单详情继续处理生产、发货和售后。"], ["订单表只能看到销售额，最终利润还要结合发货、广告、售后和平台费用。"]),
  standardTopic("production", "生产任务", "从订单或库存需求创建打印任务，记录耗材、打印机、产量、失败和实际成本。", "/app/production", ["创建生产任务并选择 SKU。", "填写计划数量、打印机和预计耗材。", "完成时填写实际耗材、打印时间、完成数量和失败数量。", "提交后生成库存流水并更新订单利润。"], ["失败数量和失败原因要如实填写。"]),
  standardTopic("inventory", "库存总览", "统一查看耗材、包装和成品库存、可用量、成本及预警状态。", "/app/inventory", ["按分类查看库存。", "关注低于警戒线的项目。", "需要修正时通过库存调整或扫码出入库记录。"], ["不要绕过业务流程直接改库存数字，库存变化必须有流水。"]),
  standardTopic("purchases", "采购管理", "记录耗材、包装和配件采购，计算入库成本并生成库存批次。", "/app/purchases", ["选择供应商和真实采购日期。", "选择物料，填写重量单位、数量、采购金额、运费、税费和优惠。", "系统换算为克并计算每克成本。", "提交后生成采购入库流水和耗材批次。"], ["采购录错时优先使用编辑或撤销，不直接删除库存流水。"]),
  standardTopic("profit-report", "利润报表", "按日期范围查看销售、成本、毛利、净利和经营费用。", "/app/reports/profit", ["进入报表中心。", "查看今日、本周、本月利润。", "继续下钻到 SKU、店铺、售后、打印机和耗材报表。"], ["利润准确性依赖订单、生产、发货、广告、售后和费用完整录入。"]),
  standardTopic("jobs", "后台任务", "查看导入、AI 生成、竞品同步等后台任务状态。", "/app/jobs", ["进入后台任务页面。", "查看等待、运行、成功、失败状态。", "失败任务可重试。"], ["大文件导入和 AI 生成会逐步迁入后台任务。"])
];

const detailedTopics: HelpTopic[] = [
  topic("help-getting-started", "第一次使用 PrintERP", "适合第一次使用系统的 3D 打印商家，按顺序完成商家空间、基础资料、采购、BOM、订单、生产、发货、售后和报表。", "/app/help/getting-started", [
    { title: "适用场景", paragraphs: ["你刚注册 PrintERP，还没有完整录入店铺、产品、SKU、耗材、采购和订单数据。"] },
    { title: "操作步骤", steps: gettingStartedSteps.map((step, index) => `第 ${index + 1} 步：${step.title}。${step.description}`) },
    { title: "注意事项", tips: ["建议按顺序完成，不要跳过 SKU、采购批次和 BOM。", "利润不准时，优先检查采购成本、BOM、发货成本、售后和广告费是否完整。"] },
    { title: "常见错误", commonMistakes: ["只导入订单，不录入耗材采购批次，导致生产成本缺失。", "把产品和 SKU 混在一起，后续库存和利润无法准确统计。"] },
    { title: "下一步建议", next: ["完成初始化后，先用少量真实订单验证利润，再批量导入历史数据。"] }
  ]),
  topic("help-setup", "初始化设置教程", "配置店铺、供应商、耗材、包装、打印机、员工权限和库存警戒线。", "/app/help/setup", [
    { title: "适用场景", paragraphs: ["适合新商家建立基础资料，或试运行后重新初始化数据。"] },
    { title: "操作步骤", steps: ["进入设置 / 店铺管理新增销售渠道。", "进入供应商管理维护耗材、包装和配件供应商。", "进入耗材管理维护 PLA、PETG、ABS、TPU 等资料。", "进入包装材料和打印机管理补齐成本基础。", "进入员工权限，按老板、财务、客服、生产员分配角色。", "为 SKU 或库存项目设置警戒线。"] },
    { title: "注意事项", tips: ["基础资料尽量先建全，再录入采购和订单。", "员工权限按岗位最小授权，财务数据只给老板、店长、财务。"] },
    { title: "常见错误", commonMistakes: ["没有建店铺就导入订单，导致渠道利润无法分析。", "供应商名称随意填写，后续无法比较供应商成本。"] },
    { title: "下一步建议", next: ["完成基础资料后，进入采购中心录入第一批耗材采购。"] }
  ]),
  topic("help-products", "产品与 SKU 管理教程", "产品是 SPU，SKU 是真实销售、库存、生产和利润核算对象。", "/app/help/products", [
    { title: "适用场景", paragraphs: ["适合整理 3D 打印商品结构，并把模型、BOM、AI 内容和竞品监控集中到产品中心。"] },
    { title: "操作步骤", steps: ["先创建产品 SPU，例如 3D 打印多肉花盆。", "在产品下添加多个 SKU，例如白色小号、灰色大号、黑色 PETG 款。", "为每个 SKU 绑定售价、颜色、规格、默认耗材、理论克重、预计打印时间、BOM / 打印配方、库存警戒线和默认模型文件。", "在产品详情中维护 AI 标题、主图、详情页工作流。", "在产品详情中绑定竞品链接，每个产品最多 5 个启用竞品。", "在产品中心使用自动选品池，把候选商品转为产品草稿。"] },
    { title: "注意事项", tips: ["SKU 不单独作为孤立业务中心，而是在产品中心展开管理。", "竞品销量必须区分 salesDisplayValue、salesEstimate、salesActual。", "第一版只支持手动录入、表格导入和半自动分析。"] },
    { title: "常见错误", commonMistakes: ["把颜色和规格都写在产品名里，不拆 SKU。", "SKU 没有 BOM 就开始算利润，生产成本会失真。"] },
    { title: "下一步建议", next: ["产品和 SKU 建好后，优先补 BOM，再导入订单。"] }
  ]),
  topic("help-materials", "耗材与采购管理教程", "采购入库生成耗材批次，并自动计算每克成本。", "/app/help/materials", [
    { title: "适用场景", paragraphs: ["适合管理 PLA、PETG、ABS、TPU、包装材料和配件采购。"] },
    { title: "操作步骤", steps: ["先维护耗材资料和供应商。", "新增采购单，选择真实采购日期。", "录入重量单位，默认 kg，也可选择 g，系统统一换算为克。", "录入采购金额、运费、税费、优惠金额。", "系统计算总成本、每克成本，并生成耗材批次库存。", "采购录错时进入采购详情编辑或撤销。"] },
    { title: "注意事项", tips: ["采购日期用于报表统计，操作时间由审计日志记录。", "耗材采购批次是生产成本核算基础。"] },
    { title: "常见错误", commonMistakes: ["只录金额不录重量，无法计算每克成本。", "把运费漏掉，导致产品成本偏低。"] },
    { title: "下一步建议", next: ["采购批次建立后，为 SKU 设置 BOM。"] }
  ]),
  topic("help-production", "生产与库存管理教程", "生产任务记录实际耗材、打印时间、完成数量和失败数量，并统一走库存流水。", "/app/help/production", [
    { title: "适用场景", paragraphs: ["适合按订单生产或备货生产，并统计打印机效率和失败成本。"] },
    { title: "操作步骤", steps: ["从订单或生产页面创建生产任务。", "选择 SKU、打印机和计划数量。", "生产完成后填写实际耗材、实际打印时间、完成数量和失败数量。", "系统扣减耗材库存、增加成品库存，并生成库存流水。", "查看打印失败记录和打印机效率。"] },
    { title: "注意事项", tips: ["库存不要直接改数量，所有变化必须通过采购、生产、发货、售后或调整流水。"] },
    { title: "常见错误", commonMistakes: ["打印失败没有记录，导致成本少算。", "实际耗材长期不校准，BOM 成本越来越偏。"] },
    { title: "下一步建议", next: ["生产完成后进入发货管理，记录物流和包装成本。"] }
  ]),
  topic("help-orders", "订单与发货管理教程", "订单详情集中查看生产、发货、售后和利润。", "/app/help/orders", [
    { title: "适用场景", paragraphs: ["适合手工录入订单、导入平台订单，并跟踪发货与利润。"] },
    { title: "操作步骤", steps: ["新建订单或导入平台订单。", "订单关联店铺、SKU、售价、优惠、实收金额。", "订单需要生产时创建生产任务。", "发货时录入快递公司、运单号、快递费用和包装材料。", "回到订单详情查看毛利、净利和成本明细。"] },
    { title: "注意事项", tips: ["订单表只能反映销售额，不能代表最终利润。", "快递费、平台费、广告费和售后成本都会影响净利。"] },
    { title: "常见错误", commonMistakes: ["导入订单后不补 SKU 和 BOM。", "发货不录快递费，利润会虚高。"] },
    { title: "下一步建议", next: ["按月核算利润时继续导入平台账单和费用表。"] }
  ]),
  topic("help-after-sales", "售后与补发管理教程", "退款、补发、破损、发错货和打印失败都会影响订单最终利润。", "/app/help/after-sales", [
    { title: "适用场景", paragraphs: ["适合客服处理退款、补发、质量问题和平台处罚。"] },
    { title: "操作步骤", steps: ["在订单详情或售后管理中新建售后。", "选择售后类型和原因。", "填写退款金额、补发成本、快递费、报废成本等。", "如果需要补发，创建对应发货记录。", "系统将售后成本计入订单净利。"] },
    { title: "注意事项", tips: ["补发不是免费操作，它会消耗成品、包装和快递。"] },
    { title: "常见错误", commonMistakes: ["只记录退款，不记录补发快递和产品成本。", "发错货未归类，后续无法分析问题原因。"] },
    { title: "下一步建议", next: ["定期查看售后原因分析，定位高损失 SKU。"] }
  ]),
  topic("help-reports", "利润报表与 3D 打印成本核算教程", "3D 打印产品成本不只是耗材，还包括损耗、失败、包装、快递、人工、折旧、电费、售后、广告和平台手续费。", "/app/help/reports", [
    { title: "适用场景", paragraphs: ["适合老板、店长和财务判断每个 SKU、店铺和时间周期是否真正赚钱。"] },
    { title: "操作步骤", steps: ["进入首页看板查看今日、本周、本月经营趋势。", "进入利润报表查看经营利润驾驶舱。", "查看 SKU 利润、店铺利润、供应商成本、耗材使用和售后损失。", "发现亏损 SKU 后回到产品中心检查售价、BOM、广告费和售后。"] },
    { title: "注意事项", tips: ["订单毛利 = 实收金额 - 产品生产成本 - 快递成本 - 包装成本 - 平台佣金 - 支付手续费。", "订单净利 = 订单毛利 - 售后成本 - 广告成本。", "生产成本包含耗材、支撑和损耗、打印失败、人工、机器折旧和电费。"] },
    { title: "常见错误", commonMistakes: ["只看销售额，不看广告、退款和快递。", "把采购支出当成当月利润扣除，却没有区分库存资产和实际消耗。"] },
    { title: "下一步建议", next: ["每周查看 SKU 利润排行，把亏损 SKU 调价、优化 BOM 或下架。"] }
  ]),
  topic("help-pdd-import", "拼多多数据导入教程", "如果想统计某个月利润，建议导入订单明细、货款、退款、推广、快递和商品 / SKU 表。", "/app/help/pdd-import", [
    { title: "适用场景", paragraphs: ["适合按月核算拼多多店铺利润，尤其是需要核对实际到账、平台扣费、广告和售后损失时。"] },
    { title: "操作步骤", steps: ["导入订单明细表：用于建立订单和销售额。", "导入对账中心 / 货款明细表：用于核对实际到账和平台扣费。", "导入售后退款表：用于计算退款和补发损失。", "导入推广费用表：用于计算广告成本。", "导入快递费用表：用于计算真实物流成本。", "导入商品 / SKU 表：用于建立产品和 SKU 基础资料。"] },
    { title: "注意事项", tips: ["订单表只能看到销售额，不能代表最终利润。", "对账中心用于核对实际到账和平台扣费。", "售后退款表用于计算退款和补发损失。", "推广费用表用于计算广告成本。", "快递费用表用于计算真实物流成本。", "商品 / SKU 表用于建立产品和 SKU 基础资料。"] },
    { title: "常见错误", commonMistakes: ["只导入订单明细表，就以为得到了利润。", "没有导入推广费用表，导致广告成本缺失。"] },
    { title: "下一步建议", next: ["先导入 1 天数据核对字段，再导入整月数据。"] }
  ]),
  topic("help-faq", "常见问题 FAQ", "解答 3D 打印电商商家第一次使用 PrintERP 时最容易遇到的问题。", "/app/help/faq", [
    { title: "适用场景", paragraphs: ["当利润、库存、SKU、BOM、拼多多导入或售后成本看起来不符合预期时，先看这里。"] },
    { title: "操作步骤", steps: [
      "为什么订单利润和我实际到账金额不一样？因为订单利润还会扣除生产成本、快递、包装、平台佣金、支付手续费、售后成本和广告成本。",
      "为什么要先录入耗材采购批次？因为系统需要根据真实采购批次计算每克成本，才能算准生产成本。",
      "为什么 SKU 必须设置 BOM？因为 BOM 定义理论耗材、损耗、包装、人工、折旧和电费，是成本核算基础。",
      "为什么库存不能直接手动改？因为直接改数字没有业务来源，无法追溯。应通过采购、生产、发货、售后或库存调整生成流水。",
      "打印失败成本应该怎么记录？在生产完成时填写失败数量、失败原因、耗材损失和成本损失。",
      "售后补发会不会影响利润？会。补发会消耗成品、包装和快递费用，应计入售后成本。",
      "拼多多订单应该导入哪些表？建议导入订单明细表、货款明细表、售后退款表、推广费用表、快递费用表、商品 / SKU 表。",
      "为什么要区分产品和 SKU？产品是 SPU，用于归类；SKU 是真实销售、库存、生产和利润核算对象。",
      "如何查看某个 SKU 是否赚钱？进入报表中心 / SKU 利润，查看销量、收入、成本、净利和利润率。",
      "如何查看每天、每周、每月利润？进入首页看板或利润报表，选择对应日期范围查看。"
    ] },
    { title: "注意事项", tips: ["FAQ 是排查入口，具体数据仍需回到订单详情、库存流水和报表核对。"] },
    { title: "常见错误", commonMistakes: ["用销售额判断赚钱。", "忽略广告费、售后和打印失败。"] },
    { title: "下一步建议", next: ["如果 FAQ 仍不能解释，请先打开订单详情查看利润追溯。"] }
  ])
];

export const helpTopics: HelpTopic[] = [...genericTopics, ...detailedTopics];
export const helpTopicMap = new Map(helpTopics.map((topic) => [topic.key, topic]));
