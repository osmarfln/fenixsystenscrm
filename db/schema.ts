import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  fullName: text("full_name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("pending"),
  permissions: text("permissions").notNull().default("{}"),
  lastSeenAt: text("last_seen_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  document: text("document"),
  address: text("address"),
  notes: text("notes"),
  source: text("source"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productCategories = sqliteTable("product_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").unique(),
  description: text("description"),
  category: text("category"),
  categoryId: text("category_id").references(() => productCategories.id, { onDelete: "set null" }),
  unit: text("unit").default("un"),
  costPrice: real("cost_price").notNull().default(0),
  salePrice: real("sale_price").notNull().default(0),
  stock: real("stock").notNull().default(0),
  minimumStock: real("minimum_stock").notNull().default(0),
  location: text("location"),
  imageUrl: text("image_url"),
  supplierId: text("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const inventoryMovements = sqliteTable("inventory_movements", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  quantity: real("quantity").notNull(),
  reason: text("reason"),
  sourceId: text("source_id"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sales = sqliteTable("sales", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  subtotal: real("subtotal").notNull().default(0),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull().default(0),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("completed"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey(),
  saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

export const cashTransactions = sqliteTable("cash_transactions", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
  saleId: text("sale_id").references(() => sales.id, { onDelete: "set null" }),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const financialCategories = sqliteTable("financial_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const financialEntries = sqliteTable("financial_entries", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  category: text("category"),
  categoryId: text("category_id").references(() => financialCategories.id, { onDelete: "set null" }),
  paymentMethod: text("payment_method"),
  dueDate: text("due_date"),
  paidAt: text("paid_at"),
  status: text("status").notNull().default("pending"),
  sourceId: text("source_id"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const accountsPayable = sqliteTable("accounts_payable", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  dueDate: text("due_date"),
  paidAt: text("paid_at"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const accountsReceivable = sqliteTable("accounts_receivable", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  dueDate: text("due_date"),
  receivedAt: text("received_at"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  title: text("title"),
  subtotal: real("subtotal").notNull().default(0),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull().default(0),
  status: text("status").notNull().default("draft"),
  validUntil: text("valid_until"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const budgetItems = sqliteTable("budget_items", {
  id: text("id").primaryKey(),
  budgetId: text("budget_id").notNull().references(() => budgets.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  total: real("total").notNull().default(0),
});

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  document: text("document"),
  position: text("position"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  module: text("module").notNull(),
  description: text("description"),
});

export const rolePermissions = sqliteTable("role_permissions", {
  id: text("id").primaryKey(),
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: text("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  allowed: integer("allowed", { mode: "boolean" }).notNull().default(true),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  action: text("action").notNull(),
  module: text("module").notNull(),
  description: text("description"),
  ipOrOrigin: text("ip_or_origin"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const systemSettings = sqliteTable("system_settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
