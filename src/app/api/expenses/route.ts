import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const categoryName = text(form, "categoryName") || "其他费用";
  const occurredAt = text(form, "occurredAt") ? new Date(`${text(form, "occurredAt")}T12:00:00`) : new Date();
  await db.$transaction(async (tx) => {
    const category = await tx.expenseCategory.upsert({
      where: { tenantId_name: { tenantId: session.tenantId, name: categoryName } },
      create: { tenantId: session.tenantId, name: categoryName, createdBy: session.userId },
      update: { updatedBy: session.userId }
    });
    const expense = await tx.expense.create({
      data: {
        tenantId: session.tenantId, categoryId: category.id, name: text(form, "name"), amount: decimalText(form, "amount"),
        occurredAt, remark: text(form, "remark") || null, createdBy: session.userId
      }
    });
    await tx.costRecord.create({
      data: { tenantId: session.tenantId, sourceType: "Expense", sourceId: expense.id, amount: expense.amount, remark: `${categoryName} · ${expense.name}`, createdBy: session.userId }
    });
    await tx.auditLog.create({
      data: { tenantId: session.tenantId, userId: session.userId, action: "expense.created", entityType: "Expense", entityId: expense.id, metadata: { categoryName, amount: expense.amount.toString() } }
    });
  });
  return NextResponse.redirect(new URL("/app/expenses?created=1", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("expenses.post", handlePost);
