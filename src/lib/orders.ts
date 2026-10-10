import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { LineItem, OrderTotals } from "./totals";
import type { DeliveryMethod } from "./shop-config";

export type OrderStatus =
  | "pending"      // created, awaiting payment
  | "processing"   // payment received
  | "completed"
  | "failed"
  | "cancelled"
  | "refunded"
  | "on-hold";

export interface Order {
  id: string;             // m_payment_id (our reference)
  reference: string;      // human-friendly, e.g. TTM-1042
  status: OrderStatus;
  customer: { firstName: string; lastName: string; email: string; phone: string };
  delivery: {
    method: DeliveryMethod;
    address?: { street: string; suburb: string; city: string; province: string; postalCode: string };
    fitmentStore?: string;
    fitmentDate?: string;
  };
  items: LineItem[];
  totals: OrderTotals;
  paymentMethod: string;
  pfPaymentId?: string;   // PayFast's pf_payment_id
  createdAt: string;
  updatedAt: string;
}

// ---- storage backends -------------------------------------------------------
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const useKV = Boolean(KV_URL && KV_TOKEN);

async function kv(command: unknown[]): Promise<unknown> {
  const res = await fetch(KV_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV error ${res.status}`);
  const data = (await res.json()) as { result: unknown };
  return data.result;
}

// file fallback (local dev only — serverless filesystems are ephemeral)
const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "orders.json");

async function readFile(): Promise<Record<string, Order>> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Record<string, Order>;
  } catch {
    return {};
  }
}
async function writeFile(all: Record<string, Order>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

// ---- public API -------------------------------------------------------------
export async function saveOrder(order: Order): Promise<void> {
  if (useKV) {
    await kv(["SET", `order:${order.id}`, JSON.stringify(order)]);
    return;
  }
  const all = await readFile();
  all[order.id] = order;
  await writeFile(all);
}

export async function getOrder(id: string): Promise<Order | null> {
  if (useKV) {
    const raw = (await kv(["GET", `order:${id}`])) as string | null;
    return raw ? (JSON.parse(raw) as Order) : null;
  }
  const all = await readFile();
  return all[id] ?? null;
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
  const current = await getOrder(id);
  if (!current) return null;
  const next: Order = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await saveOrder(next);
  return next;
}

/** Next order number (atomic via KV INCR; timestamp-based in file mode). */
export async function nextReference(): Promise<string> {
  if (useKV) {
    const n = (await kv(["INCR", "order:seq"])) as number;
    return `TTM-${1000 + n}`;
  }
  return `TTM-${Date.now().toString().slice(-7)}`;
}

export function storageMode(): "kv" | "file" {
  return useKV ? "kv" : "file";
}
