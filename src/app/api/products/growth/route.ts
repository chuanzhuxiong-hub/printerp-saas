import { Prisma } from "@prisma/client";
import Papa from "papaparse";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { detailPlan, imagePlan, opportunityAnalysis, titleCandidates } from "@/lib/product-growth";
import { assertUploadedFile, uploadLimits } from "@/lib/upload";

class ProductGrowthInputError extends Error {}

function uploadedCsv(form: FormData, label: string) {
  try {
    return assertUploadedFile(form.get("file"), { label, maxBytes: uploadLimits.productGrowthCsv, extensions: [".csv"] });
  } catch (error) {
    throw new ProductGrowthInputError(error instanceof Error ? error.message : String(error));
  }
}

function list(value: string) {
  return value.split(/[,，;；\n]/).map(item => item.trim()).filter(Boolean);
}

function integer(form: FormData, key: string) {
  return Number.parseInt(text(form, key) || "0", 10) || 0;
}

function nullableDecimal(form: FormData, key: string) {
  const value = text(form, key);
  return value ? new Prisma.Decimal(value) : null;
}

async function productForSession(productId: string, tenantId: string) {
  return db.product.findFirstOrThrow({ where: { id: productId, tenantId, deletedAt: null } });
}

async function createCompetitor(form: FormData, session: { tenantId: string; userId: string }, source = "MANUAL") {
  const productId = text(form, "productId");
  if (!productId || !text(form, "platform") || !text(form, "competitorUrl")) throw new ProductGrowthInputError("产品、平台和竞品链接为必填项");
  await productForSession(productId, session.tenantId);
  const activeCount = await db.productCompetitor.count({ where: { tenantId: session.tenantId, productId, status: "ACTIVE" } });
  if (activeCount >= 5) throw new ProductGrowthInputError("每个产品最多绑定 5 个启用竞品链接");
  const salesDisplayValue = text(form, "salesDisplayValue") || null;
  const salesEstimate = nullableDecimal(form, "salesEstimate");
  const salesActual = nullableDecimal(form, "salesActual");
  const competitor = await db.productCompetitor.create({
    data: {
      tenantId: session.tenantId, productId, platform: text(form, "platform"), competitorUrl: text(form, "competitorUrl"),
      competitorProductId: text(form, "competitorProductId") || null, title: text(form, "title") || null, mainImageUrl: text(form, "mainImageUrl") || null,
      shopName: text(form, "shopName") || null, currentPrice: decimalText(form, "currentPrice"), originalPrice: decimalText(form, "originalPrice"),
      salesDisplayValue, salesEstimate, salesActual, reviewCount: integer(form, "reviewCount"), activityInfo: text(form, "activityInfo") || null,
      specification: text(form, "specification") || null, dataSource: source, rawData: { source, enteredAt: new Date().toISOString() }, createdBy: session.userId
    }
  });
  await db.competitorSnapshot.create({
    data: {
      tenantId: session.tenantId, competitorId: competitor.id, price: competitor.currentPrice, originalPrice: competitor.originalPrice,
      salesDisplayValue, salesEstimate, salesActual, reviewCount: competitor.reviewCount, activityInfo: competitor.activityInfo,
      title: competitor.title, mainImageUrl: competitor.mainImageUrl, dataSource: source, rawData: { source, copiedFrom: competitor.id }
    }
  });
  return competitor;
}

async function updateCompetitor(form: FormData, session: { tenantId: string; userId: string }, source = "MANUAL_UPDATE") {
  const competitorId = text(form, "competitorId");
  if (!competitorId || !text(form, "platform") || !text(form, "competitorUrl")) throw new ProductGrowthInputError("平台和竞品链接为必填项");
  const existing = await db.productCompetitor.findFirstOrThrow({ where: { id: competitorId, tenantId: session.tenantId } });
  const currentPrice = new Prisma.Decimal(decimalText(form, "currentPrice"));
  const originalPrice = new Prisma.Decimal(decimalText(form, "originalPrice"));
  const salesDisplayValue = text(form, "salesDisplayValue") || null;
  const salesEstimate = nullableDecimal(form, "salesEstimate");
  const salesActual = nullableDecimal(form, "salesActual");
  const title = text(form, "title") || null;
  const mainImageUrl = text(form, "mainImageUrl") || null;
  const activityInfo = text(form, "activityInfo") || null;
  const reviewCount = integer(form, "reviewCount");
  const alerts: Prisma.CompetitorAlertCreateManyInput[] = [];
  const addAlert = (alertType: string, severity: string, alertTitle: string, description: string, previousValue: string | null, currentValue: string | null) => {
    alerts.push({ tenantId: session.tenantId, productId: existing.productId, competitorId, alertType, severity, title: alertTitle, description, previousValue, currentValue });
  };

  if (!existing.currentPrice.equals(currentPrice)) {
    const lowered = currentPrice.lt(existing.currentPrice);
    addAlert(lowered ? "PRICE_DROP" : "PRICE_RISE", lowered ? "WARNING" : "INFO", lowered ? "竞品降价" : "竞品涨价", `竞品价格由 ${existing.currentPrice.toFixed(2)} 变为 ${currentPrice.toFixed(2)}`, existing.currentPrice.toFixed(2), currentPrice.toFixed(2));
  }
  if ((existing.activityInfo ?? "") !== (activityInfo ?? "")) addAlert("ACTIVITY_CHANGE", "WARNING", "竞品活动变化", "竞品活动信息已更新", existing.activityInfo, activityInfo);
  if ((existing.title ?? "") !== (title ?? "")) addAlert("TITLE_CHANGE", "INFO", "竞品标题变化", "竞品标题已更新", existing.title, title);
  if ((existing.mainImageUrl ?? "") !== (mainImageUrl ?? "")) addAlert("IMAGE_CHANGE", "INFO", "竞品主图变化", "竞品主图地址已更新", existing.mainImageUrl, mainImageUrl);
  if ((existing.salesDisplayValue ?? "") !== (salesDisplayValue ?? "")) addAlert("SALES_DISPLAY_CHANGE", "INFO", "竞品销量展示值变化", "页面展示销量已更新，不代表真实销量", existing.salesDisplayValue, salesDisplayValue);

  const updated = await db.$transaction(async tx => {
    const competitor = await tx.productCompetitor.update({
      where: { id: competitorId },
      data: {
        platform: text(form, "platform"), competitorUrl: text(form, "competitorUrl"), competitorProductId: text(form, "competitorProductId") || null,
        title, mainImageUrl, shopName: text(form, "shopName") || null, currentPrice, originalPrice, salesDisplayValue, salesEstimate, salesActual,
        reviewCount, activityInfo, specification: text(form, "specification") || null, dataSource: source,
        rawData: { source, enteredAt: new Date().toISOString() }, updatedBy: session.userId
      }
    });
    await tx.competitorSnapshot.create({
      data: {
        tenantId: session.tenantId, competitorId, price: currentPrice, originalPrice, salesDisplayValue, salesEstimate, salesActual,
        reviewCount, activityInfo, title, mainImageUrl, dataSource: source, rawData: { source, copiedFrom: competitorId }
      }
    });
    if (alerts.length) await tx.competitorAlert.createMany({ data: alerts });
    return competitor;
  });
  return updated;
}

async function createOpportunity(form: FormData, session: { tenantId: string; userId: string }, source = "MANUAL") {
  if (!text(form, "keyword") || !text(form, "title")) throw new ProductGrowthInputError("关键词和候选商品标题为必填项");
  const price = new Prisma.Decimal(decimalText(form, "price"));
  const estimatedCost = new Prisma.Decimal(decimalText(form, "estimatedCost"));
  const analysis = opportunityAnalysis({
    price, estimatedCost, salesEstimate: nullableDecimal(form, "salesEstimate"), reviewCount: integer(form, "reviewCount"),
    competitorCount: integer(form, "competitorCount"), printDifficultyScore: new Prisma.Decimal(decimalText(form, "printDifficultyScore")),
    afterSaleRiskScore: new Prisma.Decimal(decimalText(form, "afterSaleRiskScore"))
  });
  return db.productOpportunity.create({
    data: {
      tenantId: session.tenantId, keyword: text(form, "keyword"), platform: text(form, "platform"), productUrl: text(form, "productUrl") || null,
      title: text(form, "title"), price, salesDisplayValue: text(form, "salesDisplayValue") || null, salesEstimate: nullableDecimal(form, "salesEstimate"),
      salesActual: nullableDecimal(form, "salesActual"), reviewCount: integer(form, "reviewCount"), category: text(form, "category") || null,
      shopName: text(form, "shopName") || null, competitorCount: integer(form, "competitorCount"), estimatedCost, estimatedMargin: analysis.margin,
      demandScore: analysis.demand, competitionScore: analysis.competitionFriendly, printDifficultyScore: decimalText(form, "printDifficultyScore"),
      afterSaleRiskScore: decimalText(form, "afterSaleRiskScore"), opportunityScore: analysis.score, aiRecommendation: analysis.recommendation,
      dataSource: source, rawData: { source, analyzedBy: "RULE_ASSISTED_V1" }, createdBy: session.userId
    }
  });
}

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const action = text(form, "action");
  const productId = text(form, "productId");
  let successMessage = "操作已保存";
  const requireContentReviewer = () => {
    if (!["OWNER", "MANAGER"].includes(session.role)) throw new ProductGrowthInputError("只有老板或店长可以审核和采用电商内容");
  };

  if (action === "generate-title") {
    const product = await productForSession(productId, session.tenantId);
    const input = { productName: product.name, keywords: list(text(form, "keywords")), sellingPoints: list(text(form, "sellingPoints")), platform: text(form, "platform") };
    const candidates = titleCandidates(input);
    const currentCount = await db.productTitleVersion.count({ where: { tenantId: session.tenantId, productId } });
    await db.$transaction([
      ...candidates.map((candidate, index) => db.productTitleVersion.create({ data: { tenantId: session.tenantId, productId, version: currentCount + index + 1, platform: input.platform, title: candidate.title, keywords: input.keywords.join("、"), score: candidate.score, riskNotes: candidate.riskNotes || null, createdBy: session.userId } })),
      db.productAiGenerationJob.create({ data: { tenantId: session.tenantId, productId, jobType: "TITLE", platform: input.platform, input: input as Prisma.InputJsonValue, result: candidates as Prisma.InputJsonValue, createdBy: session.userId } })
    ]);
  } else if (action === "generate-detail") {
    const product = await productForSession(productId, session.tenantId);
    const input = { productName: product.name, keywords: list(text(form, "keywords")), sellingPoints: list(text(form, "sellingPoints")), audience: text(form, "audience"), scenarios: text(form, "scenarios") };
    const modules = detailPlan(input);
    const version = await db.productDetailVersion.count({ where: { tenantId: session.tenantId, productId } });
    await db.$transaction([
      db.productDetailVersion.create({ data: { tenantId: session.tenantId, productId, version: version + 1, platform: text(form, "platform"), modules: modules as Prisma.InputJsonValue, aiContent: modules.map(item => `${item.module}：${item.content}`).join("\n"), createdBy: session.userId } }),
      db.productAiGenerationJob.create({ data: { tenantId: session.tenantId, productId, jobType: "DETAIL", platform: text(form, "platform"), input: input as Prisma.InputJsonValue, result: modules as Prisma.InputJsonValue, createdBy: session.userId } })
    ]);
  } else if (action === "create-image-workflow") {
    const product = await productForSession(productId, session.tenantId);
    const input = { productName: product.name, assetType: text(form, "assetType"), sellingPoints: list(text(form, "sellingPoints")), platform: text(form, "platform") };
    const plan = imagePlan(input);
    await db.$transaction([
      db.productContentAsset.create({ data: { tenantId: session.tenantId, productId, assetType: input.assetType, platform: input.platform, sourceUrl: text(form, "sourceUrl") || null, planText: plan.planText, generatedPrompt: plan.prompt, reviewStatus: "PENDING_REVIEW", createdBy: session.userId } }),
      db.productAiGenerationJob.create({ data: { tenantId: session.tenantId, productId, jobType: "IMAGE_PLAN", platform: input.platform, input: input as Prisma.InputJsonValue, prompt: plan.prompt, result: plan as Prisma.InputJsonValue, createdBy: session.userId } })
    ]);
  } else if (action === "review-content") {
    requireContentReviewer();
    const contentType = text(form, "contentType");
    const contentId = text(form, "contentId");
    const reviewStatus = text(form, "reviewStatus");
    if (!["APPROVED", "REJECTED", "PENDING_REVIEW"].includes(reviewStatus)) throw new ProductGrowthInputError("不支持的审核状态");
    if (contentType === "title") {
      await db.productTitleVersion.updateMany({ where: { id: contentId, productId, tenantId: session.tenantId }, data: { reviewStatus } });
    } else if (contentType === "detail") {
      await db.productDetailVersion.updateMany({ where: { id: contentId, productId, tenantId: session.tenantId }, data: { reviewStatus } });
    } else if (contentType === "asset") {
      await db.productContentAsset.updateMany({ where: { id: contentId, productId, tenantId: session.tenantId }, data: { reviewStatus } });
    } else {
      throw new ProductGrowthInputError("不支持的内容类型");
    }
  } else if (action === "adopt-content") {
    requireContentReviewer();
    const contentType = text(form, "contentType");
    const contentId = text(form, "contentId");
    if (contentType === "title") {
      const item = await db.productTitleVersion.findFirstOrThrow({ where: { id: contentId, productId, tenantId: session.tenantId } });
      await db.$transaction([
        db.productTitleVersion.updateMany({ where: { productId, tenantId: session.tenantId, platform: item.platform }, data: { isCurrent: false } }),
        db.productTitleVersion.update({ where: { id: contentId }, data: { isCurrent: true, reviewStatus: "APPROVED" } })
      ]);
    } else if (contentType === "detail") {
      const item = await db.productDetailVersion.findFirstOrThrow({ where: { id: contentId, productId, tenantId: session.tenantId } });
      await db.$transaction([
        db.productDetailVersion.updateMany({ where: { productId, tenantId: session.tenantId, platform: item.platform }, data: { isCurrent: false } }),
        db.productDetailVersion.update({ where: { id: contentId }, data: { isCurrent: true, reviewStatus: "APPROVED" } })
      ]);
    } else if (contentType === "asset") {
      const item = await db.productContentAsset.findFirstOrThrow({ where: { id: contentId, productId, tenantId: session.tenantId } });
      await db.$transaction([
        db.productContentAsset.updateMany({ where: { productId, tenantId: session.tenantId, platform: item.platform, assetType: item.assetType }, data: { usageStatus: "BACKUP" } }),
        db.productContentAsset.update({ where: { id: contentId }, data: { usageStatus: "ACTIVE", reviewStatus: "APPROVED" } })
      ]);
    } else {
      throw new ProductGrowthInputError("不支持的内容类型");
    }
  } else if (action === "add-competitor") {
    await createCompetitor(form, session);
  } else if (action === "update-competitor") {
    await updateCompetitor(form, session);
  } else if (action === "toggle-competitor") {
    const competitor = await db.productCompetitor.findFirstOrThrow({ where: { id: text(form, "competitorId"), tenantId: session.tenantId } });
    const nextStatus = competitor.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (nextStatus === "ACTIVE") {
      const activeCount = await db.productCompetitor.count({ where: { tenantId: session.tenantId, productId: competitor.productId, status: "ACTIVE" } });
      if (activeCount >= 5) throw new ProductGrowthInputError("每个产品最多绑定 5 个启用竞品链接");
    }
    await db.productCompetitor.update({ where: { id: competitor.id }, data: { status: nextStatus, updatedBy: session.userId } });
  } else if (action === "mark-alert-read") {
    await db.competitorAlert.updateMany({ where: { id: text(form, "alertId"), tenantId: session.tenantId }, data: { status: "READ", readAt: new Date() } });
  } else if (action === "import-competitors") {
    const file = uploadedCsv(form, "竞品 CSV");
    const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new ProductGrowthInputError(`竞品 CSV 解析失败：${parsed.errors[0].message}`);
    const invalidRows = parsed.data.flatMap((row, index) => row.platform?.trim() && row.competitorUrl?.trim() ? [] : [index + 2]);
    if (invalidRows.length) throw new ProductGrowthInputError(`竞品 CSV 第 ${invalidRows.slice(0, 10).join("、")} 行缺少 platform 或 competitorUrl`);
    const activeCount = await db.productCompetitor.count({ where: { tenantId: session.tenantId, productId, status: "ACTIVE" } });
    if (activeCount + parsed.data.length > 5) throw new ProductGrowthInputError(`导入后将超过每个产品最多 5 个竞品的限制，当前还可添加 ${5 - activeCount} 个`);
    for (const row of parsed.data) {
      const rowForm = new FormData();
      for (const [key, value] of Object.entries(row)) rowForm.set(key, value ?? "");
      rowForm.set("productId", productId);
      await createCompetitor(rowForm, session, "CSV_IMPORT");
    }
    successMessage = `成功导入 ${parsed.data.length} 个竞品并保存快照`;
  } else if (action === "add-opportunity") {
    await createOpportunity(form, session);
  } else if (action === "import-opportunities") {
    const file = uploadedCsv(form, "选品池 CSV");
    const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new ProductGrowthInputError(`选品池 CSV 解析失败：${parsed.errors[0].message}`);
    const invalidRows = parsed.data.flatMap((row, index) => row.keyword?.trim() && row.title?.trim() ? [] : [index + 2]);
    if (invalidRows.length) throw new ProductGrowthInputError(`选品池 CSV 第 ${invalidRows.slice(0, 10).join("、")} 行缺少 keyword 或 title`);
    for (const row of parsed.data) {
      const rowForm = new FormData();
      for (const [key, value] of Object.entries(row)) rowForm.set(key, value ?? "");
      await createOpportunity(rowForm, session, "CSV_IMPORT");
    }
    successMessage = `成功导入并分析 ${parsed.data.length} 个选品候选`;
  } else if (action === "convert-opportunity") {
    const opportunity = await db.productOpportunity.findFirstOrThrow({ where: { id: text(form, "opportunityId"), tenantId: session.tenantId } });
    const product = await db.product.create({ data: { tenantId: session.tenantId, name: opportunity.title, category: opportunity.category, description: `由选品池转为产品草稿。关键词：${opportunity.keyword}`, isActive: false, createdBy: session.userId } });
    await db.productOpportunity.update({ where: { id: opportunity.id }, data: { status: "CONVERTED", convertedProductId: product.id, updatedBy: session.userId } });
  } else if (action === "bulk-opportunity-status") {
    const ids = form.getAll("opportunityIds").map(String).filter(Boolean);
    const status = text(form, "status");
    if (!ids.length) throw new ProductGrowthInputError("请至少选择一个选品候选");
    if (!["PENDING", "SHORTLISTED", "REJECTED"].includes(status)) throw new ProductGrowthInputError("不支持的选品状态");
    await db.productOpportunity.updateMany({ where: { id: { in: ids }, tenantId: session.tenantId, status: { not: "CONVERTED" } }, data: { status, updatedBy: session.userId } });
    successMessage = `已批量更新 ${ids.length} 个选品候选`;
  } else if (action === "bulk-convert-opportunities") {
    const ids = form.getAll("opportunityIds").map(String).filter(Boolean);
    if (!ids.length) throw new ProductGrowthInputError("请至少选择一个选品候选");
    const opportunities = await db.productOpportunity.findMany({ where: { id: { in: ids }, tenantId: session.tenantId, status: { not: "CONVERTED" } } });
    await db.$transaction(async tx => {
      for (const opportunity of opportunities) {
        const product = await tx.product.create({ data: { tenantId: session.tenantId, name: opportunity.title, category: opportunity.category, description: `由选品池批量转为产品草稿。关键词：${opportunity.keyword}`, isActive: false, createdBy: session.userId } });
        await tx.productOpportunity.update({ where: { id: opportunity.id }, data: { status: "CONVERTED", convertedProductId: product.id, updatedBy: session.userId } });
      }
    });
    successMessage = `已批量转换 ${opportunities.length} 个产品草稿`;
  } else {
    throw new ProductGrowthInputError("不支持的产品增长操作");
  }
  await db.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: `product-growth.${action}`, entityType: "Product", entityId: productId || "opportunity" } });
  const target = productId ? `/app/products/${productId}?saved=1&message=${encodeURIComponent(successMessage)}` : `/app/products?tab=opportunities&saved=1&message=${encodeURIComponent(successMessage)}`;
  return NextResponse.redirect(new URL(target, process.env.APP_URL ?? request.url), 303);
}

async function post(request: Request, logContext: RequestLogContext) {
  try {
    return await handlePost(request, logContext);
  } catch (error) {
    if (error instanceof ProductGrowthInputError) {
      if (request.headers.get("accept")?.includes("text/html")) {
        const referer = request.headers.get("referer");
        const base = new URL(process.env.APP_URL ?? request.url);
        const candidate = referer ? new URL(referer) : new URL("/app/products", base);
        const target = candidate.origin === base.origin ? candidate : new URL("/app/products", base);
        target.searchParams.set("error", error.message);
        return NextResponse.redirect(target, 303);
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "找不到对应数据或无权访问" }, { status: 404 });
    }
    throw error;
  }
}

export const POST = withApiLogging("product-growth.action", post);
