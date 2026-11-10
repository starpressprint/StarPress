import fs from "fs";
import path from "path";

/**
 * Resilient persistent storage for Star Press.
 * Automatically persists data to local JSON file when external PostgreSQL
 * is not connected or in local development.
 * In production with a working Prisma connection, Prisma is used first.
 */

const DATA_DIR = path.join(process.cwd(), "src", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

export interface PersistedOrder {
  id: string;
  orderNumber: string;
  userId?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestName?: string | null;
  status: string; // PENDING, CONFIRMED, IN_PRODUCTION, DISPATCHED, DELIVERED, CANCELLED
  subtotal: number;
  gstAmount: number | null;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  shippingAddress: any;
  billingAddress?: any;
  paymentMethod: string;
  paymentStatus: string; // UNPAID, PAID, FAILED, REFUNDED
  paymentId?: string | null;
  trackingNumber?: string | null;
  courierPartner?: string | null;
  notes?: string | null;
  items: Array<{
    id: string;
    productId?: string | null;
    productName: string;
    productSlug: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    specs?: any;
    customText?: string | null;
    artworkUrl?: string | null;
    previewUrl?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  currency: string;
  timezone: string;
  gstin?: string;
  pan?: string;
}

export interface StoreData {
  orders: PersistedOrder[];
  customProducts: any[];
  productOverrides?: Record<string, any>;
  settings: StoreSettings;
}

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Star Press",
  storeEmail: "starpress.print@gmail.com",
  storePhone: "+91 74568 49955",
  storeAddress: "Amoun, Khatima (Uttarakhand)",
  currency: "INR",
  timezone: "Asia/Kolkata",
  gstin: "07AAAAA0000A1Z5",
};

// In-memory cache for serverless environments where disk may be read-only
let memoryStoreCache: StoreData | null = null;

function ensureStoreFile(): StoreData {
  if (memoryStoreCache) {
    return memoryStoreCache;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
    }
    if (!fs.existsSync(STORE_FILE)) {
      const initial: StoreData = {
        orders: [],
        customProducts: [],
        productOverrides: {},
        settings: DEFAULT_SETTINGS,
      };
      try { fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), "utf-8"); } catch {}
      memoryStoreCache = initial;
      return initial;
    }
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.productOverrides) parsed.productOverrides = {};
    memoryStoreCache = parsed;
    return parsed;
  } catch (err) {
    console.warn("[Store] Falling back to memory store cache:", err);
    memoryStoreCache = { orders: [], customProducts: [], productOverrides: {}, settings: DEFAULT_SETTINGS };
    return memoryStoreCache;
  }
}

function saveStore(data: StoreData) {
  memoryStoreCache = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Store] Notice: Disk write skipped (ephemeral/serverless environment):", (err as any)?.message);
  }
}

export const persistentStore = {
  getOrders(): PersistedOrder[] {
    const store = ensureStoreFile();
    return store.orders || [];
  },

  getOrderById(idOrNumber: string): PersistedOrder | null {
    const orders = this.getOrders();
    const clean = idOrNumber.trim().toUpperCase();
    return (
      orders.find(
        (o) =>
          o.id === idOrNumber ||
          o.orderNumber.toUpperCase() === clean
      ) || null
    );
  },

  saveOrder(order: PersistedOrder): PersistedOrder {
    const store = ensureStoreFile();
    const nowIso = new Date().toISOString();
    const validCreatedAt =
      order.createdAt &&
      order.createdAt !== "undefined" &&
      !isNaN(new Date(order.createdAt).getTime())
        ? new Date(order.createdAt).toISOString()
        : nowIso;
    const validUpdatedAt =
      order.updatedAt &&
      order.updatedAt !== "undefined" &&
      !isNaN(new Date(order.updatedAt).getTime())
        ? new Date(order.updatedAt).toISOString()
        : nowIso;

    const sanitizedOrder: PersistedOrder = {
      ...order,
      createdAt: validCreatedAt,
      updatedAt: validUpdatedAt,
    };

    const existingIndex = store.orders.findIndex(
      (o) => o.id === sanitizedOrder.id || o.orderNumber === sanitizedOrder.orderNumber
    );
    if (existingIndex >= 0) {
      store.orders[existingIndex] = { ...sanitizedOrder, updatedAt: nowIso };
    } else {
      store.orders.unshift(sanitizedOrder);
    }
    saveStore(store);
    return sanitizedOrder;
  },

  deleteOrder(idOrNumber: string): boolean {
    const store = ensureStoreFile();
    const clean = idOrNumber.trim().toUpperCase();
    const before = store.orders.length;
    store.orders = store.orders.filter(
      (o) => o.id !== idOrNumber && o.orderNumber.toUpperCase() !== clean
    );
    saveStore(store);
    return store.orders.length < before;
  },

  updateOrderStatus(
    idOrNumber: string,
    status: string,
    tracking?: { trackingNumber?: string; courierPartner?: string; notes?: string }
  ): PersistedOrder | null {
    const store = ensureStoreFile();
    const order = store.orders.find(
      (o) => o.id === idOrNumber || o.orderNumber.toUpperCase() === idOrNumber.trim().toUpperCase()
    );
    if (!order) return null;

    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (tracking?.trackingNumber) order.trackingNumber = tracking.trackingNumber;
    if (tracking?.courierPartner) order.courierPartner = tracking.courierPartner;
    if (tracking?.notes) order.notes = tracking.notes;

    saveStore(store);
    return order;
  },

  getCustomProducts(): any[] {
    const store = ensureStoreFile();
    return store.customProducts || [];
  },

  saveCustomProduct(product: any): any {
    const store = ensureStoreFile();
    const idx = store.customProducts.findIndex((p) => p.id === product.id);
    if (idx >= 0) {
      store.customProducts[idx] = { ...product, updatedAt: new Date().toISOString() };
    } else {
      store.customProducts.unshift(product);
    }
    saveStore(store);
    return product;
  },

  deleteCustomProduct(id: string): boolean {
    const store = ensureStoreFile();
    const before = store.customProducts.length;
    store.customProducts = store.customProducts.filter((p) => p.id !== id);
    saveStore(store);
    return store.customProducts.length < before;
  },

  getProductOverrides(): Record<string, any> {
    const store = ensureStoreFile();
    return store.productOverrides || {};
  },

  saveProductOverride(idOrSlug: string, overrideData: any): any {
    const store = ensureStoreFile();
    if (!store.productOverrides) store.productOverrides = {};
    const existing = store.productOverrides[idOrSlug] || {};
    store.productOverrides[idOrSlug] = {
      ...existing,
      ...overrideData,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);
    return store.productOverrides[idOrSlug];
  },

  getSettings(): StoreSettings {
    const store = ensureStoreFile();
    return store.settings || DEFAULT_SETTINGS;
  },

  saveSettings(newSettings: Partial<StoreSettings>): StoreSettings {
    const store = ensureStoreFile();
    store.settings = { ...store.settings, ...newSettings };
    saveStore(store);
    return store.settings;
  },
};
