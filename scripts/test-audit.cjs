// Offline behavior tests. No real database, network, email or local order writes.
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } });
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(process.cwd(), 'src', request.slice(2)) : request, ...args);
};
const unexpected = async () => { throw new Error('Unexpected external database access'); };
const table = () => new Proxy({}, { get: (_target, key) => key === 'then' ? undefined : unexpected });
const database = new Proxy({}, { get: (target, key) => target[key] ?? (target[key] = table()) });
global.prisma = database;
global.fetch = async () => { throw new Error('Unexpected external network access'); };
function stub(file, exports) { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub('../src/server/storage.ts', { persistentStore: new Proxy({}, { get: () => () => { throw new Error('Local store writes forbidden in tests'); } }) });
stub('../src/server/email.ts', new Proxy({}, { get: () => async () => {} }));
stub('../src/server/payment-audit.ts', { auditPaymentEvent: async () => {} });
stub('../src/lib/auth-resolver.ts', { resolveUser: async () => ({ id: 'customer', email: 'customer@example.test' }) });
stub('../src/lib/auth.ts', { authOptions: {} });
stub('../src/lib/supabase/server.ts', { getSessionUser: async () => ({ id: 'customer', email: 'customer@example.test' }) });
stub('../src/lib/user-sync.ts', { ensureDbUser: async () => ({ id: 'customer' }) });
const { NextRequest } = require('next/server');
const request = (url, body, method = 'POST') => new NextRequest('http://localhost:3000' + url, { method, ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}) });
let count = 0;
async function test(name, fn) { await fn(); count++; console.log('PASS:', name); }
async function main() {
  const { isUserAdmin } = require('../src/lib/admin/is-admin.ts');
  process.env.ADMIN_EMAILS = 'admin@example.test';
  await test('Unverified allowlisted email cannot become admin', () => assert.equal(isUserAdmin({ email: 'admin@example.test' }), false));
  await test('Verified allowlisted email retains access', () => assert.equal(isUserAdmin({ email: 'admin@example.test', email_confirmed_at: '2026-01-01' }), true));
  await test('Authoritative role retains admin access', () => assert.equal(isUserAdmin({ app_metadata: { role: 'ADMIN' } }), true));
  const { quoteOrder } = require('../src/server/quote.ts');
  const client = { product: { findFirst: async () => null }, discount: { findUnique: async () => null } };
  await test('Catalog batch price unchanged', async () => assert.equal((await quoteOrder({ items: [{ slug: 'business-cards', quantity: 100 }] }, client)).subtotal, 299));
  for (const quantity of [0, -1, 1.5, Infinity, 1000001, '10']) {
    await test(`Reject invalid quantity ${quantity}`, () => assert.rejects(quoteOrder({ items: [{ slug: 'business-cards', quantity }] }, client), error => error.statusCode === 400));
  }
  await test('Reject nonexistent size', () => assert.rejects(quoteOrder({ items: [{ slug: 'business-cards', quantity: 100, sizeId: 'invented' }] }, client), /option is unavailable/));
  await test('Deleted built-in coupon cannot be used', () => assert.rejects(quoteOrder({ items: [{ slug: 'business-cards', quantity: 100 }], couponCode: 'STAR10' }, client), /Invalid discount/));
  await test('DB outage cannot silently quote stale catalog', () => assert.rejects(quoteOrder({ items: [{ slug: 'business-cards', quantity: 100 }] }, { product: { findFirst: unexpected } }), error => error.statusCode === 503));
  const { createOrder, trackOrder, updateOrderStatus, createAdminOrder } = require('../src/server/orders.ts');
  database.order = { findUnique: async () => ({ orderNumber: 'SP-TEST', guestPhone: '+91 98765 43210', guestEmail: 'buyer@example.test' }), create: unexpected };
  for (const value of ['', ' ', '9', '43210', 'other@example.test']) {
    await test(`Tracking rejects partial/wrong contact ${JSON.stringify(value)}`, async () => assert.equal(await trackOrder('SP-TEST', value), null));
  }
  await test('Tracking accepts full formatted phone', async () => assert.ok(await trackOrder('SP-TEST', '9876543210')));
  await test('Tracking accepts exact case-insensitive email', async () => assert.ok(await trackOrder('SP-TEST', 'BUYER@example.test')));
  database.$transaction = unexpected;
  await test('Failed status write never reports success', async () => assert.equal((await updateOrderStatus('order', 'CANCELLED', undefined, database)).success, false));
  await test('Failed manual order write never reports success', () => assert.rejects(createAdminOrder({ customerName: 'Test', customerPhone: '9876543210', items: [{ productName: 'Card', quantity: 1, unitPrice: 100 }] }, 'admin@example.test'), /could not be saved/));
  const { recordPaymentSuccess } = require('../src/server/payments.ts');
  await test('Payment cannot be replayed against another order', async () => {
    const result = await recordPaymentSuccess({ orderId: 'other', paymentId: 'pay_real', amount: 100 }, { paymentTransaction: { findFirst: async () => ({ orderId: 'original', status: 'CAPTURED' }) } });
    assert.equal(result.success, false);
  });
  const paymentClient = { paymentTransaction: { findFirst: async () => null }, $transaction: async callback => callback({ $queryRaw: async () => [], order: { findUnique: async () => ({ totalAmount: 100, razorpayOrderId: 'order_expected' }) } }) };
  await test('Recorder rejects amount mismatch', async () => assert.equal((await recordPaymentSuccess({ orderId: 'order', paymentId: 'pay_real', amount: 1 }, paymentClient)).success, false));
  await test('Recorder rejects gateway binding mismatch', async () => assert.equal((await recordPaymentSuccess({ orderId: 'order', paymentId: 'pay_real', amount: 100, razorpayOrderId: 'order_wrong' }, paymentClient)).success, false));
  const inquiries = require('../src/server/inquiries.ts');
  for (const fn of ['createContactInquiry', 'createBulkOrderInquiry', 'createCustomPrintInquiry']) {
    await test(`${fn} propagates persistence failure`, () => assert.rejects(inquiries[fn]({ name: 'Test', message: 'test', phone: '9876543210', email: 'test@example.test' }), /could not be saved/));
  }
  database.product = { findFirst: async () => null, create: async () => { throw new Error('Review must not create product'); } };
  await test('Review of unknown product returns 404', async () => assert.equal((await require('../src/app/api/reviews/route.ts').POST(request('/api/reviews', { productId: 'fake-product', rating: 5 }))).status, 404));
  const addresses = require('../src/app/api/account/addresses/route.ts');
  await test('Address read outage returns 503, not empty success', async () => assert.equal((await addresses.GET(request('/api/account/addresses', null, 'GET'))).status, 503));
  await test('Address write outage returns 503, not fabricated address', async () => assert.equal((await addresses.POST(request('/api/account/addresses', { line1: '1 Test Road', city: 'Khatima', state: 'Uttarakhand', pincode: '262308', phone: '9876543210' }))).status, 503));
  // Exercise the legacy verifier through HMAC and gateway REST checks.
  const crypto = require('node:crypto');
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_test_local'; process.env.RAZORPAY_KEY_SECRET = 'offline-test-secret';
  database.order.findFirst = async () => ({ id: 'order', userId: 'customer', totalAmount: 100, razorpayOrderId: 'order_rzp', paymentStatus: 'UNPAID' });
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update('order_rzp|pay_real').digest('hex');
  global.fetch = async () => new Response(JSON.stringify({ status: 'authorized', amount: 10000, currency: 'INR', order_id: 'order_rzp' }), { status: 200 });
  await test('Authorized payment is not marked paid', async () => assert.equal((await require('../src/app/api/verify-payment/route.ts').POST(request('/api/verify-payment', { order_id: 'order_rzp', payment_id: 'pay_real', signature }))).status, 400));
  await test('Main verifier rejects mismatched stored gateway order', async () => {
    const response = await require('../src/app/api/payments/razorpay/verify/route.ts').POST(request('/api/payments/razorpay/verify', {
      orderId: 'order', razorpay_order_id: 'order_other', razorpay_payment_id: 'pay_real', razorpay_signature: signature,
    }));
    assert.equal(response.status, 400);
  });
  await test('Main verifier also rejects authorized payment', async () => {
    const response = await require('../src/app/api/payments/razorpay/verify/route.ts').POST(request('/api/payments/razorpay/verify', {
      orderId: 'order', razorpay_order_id: 'order_rzp', razorpay_payment_id: 'pay_real', razorpay_signature: signature,
    }));
    assert.equal(response.status, 400);
  });
  await test('Address creation transaction restores default after write failure', async () => {
    let isDefault = true;
    database.$transaction = async callback => {
      const before = isDefault;
      try { return await callback({
        $queryRaw: async () => [],
        address: { count: async () => 1, updateMany: async () => { isDefault = false; }, create: unexpected },
      }); } catch (error) { isDefault = before; throw error; }
    };
    const response = await addresses.POST(request('/api/account/addresses', { line1: '1 Test Road', city: 'Khatima', state: 'Uttarakhand', pincode: '262308', phone: '9876543210', isDefault: true }));
    assert.equal(response.status, 503);
    assert.equal(isDefault, true);
  });
  await test('Profile update failure returns 503', async () => {
    database.user = { findFirst: async () => ({ id: 'customer' }), update: unexpected };
    const response = await require('../src/app/api/account/profile/route.ts').PATCH(request('/api/account/profile', { name: 'Updated Name' }, 'PATCH'));
    assert.equal(response.status, 503);
  });
  const integrity = require('../src/server/order-integrity.ts');
  await test('Request hash ignores object key order', () => assert.equal(integrity.orderRequestHash({ a: 1, b: 2 }), integrity.orderRequestHash({ b: 2, a: 1 })));
  await test('Edited notes retain retry and coupon metadata', () => assert.equal(integrity.mergeOrderNotes('old [idempotency:abc] [coupon:STAR10]', 'new [coupon:FORGED]'), 'new [idempotency:abc] [coupon:STAR10]'));

  const orderInput = { userId: 'customer', idempotencyKey: 'parallel-checkout', paymentMethod: 'ONLINE',
    shippingAddress: { fullName: 'Test Customer', email: 'customer@example.test', phone: '9876543210', addressLine1: '1 Test Road', city: 'Khatima', state: 'Uttarakhand', pincode: '262308' },
    items: [{ slug: 'business-cards', quantity: 100 }],
  };
  let savedOrder = null, createdCount = 0, lockCount = 0;
  let tail = Promise.resolve();
  const parallelClient = {
    product: { findFirst: async () => null },
    order: { findFirst: async () => savedOrder },
    $transaction: async callback => {
      const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
      try { return await callback({
        $queryRaw: async () => { lockCount++; return []; },
        product: { findFirst: async () => null },
        order: { findFirst: async () => savedOrder, create: async ({ data }) => {
          createdCount++; savedOrder = { ...data, id: 'parallel-order', items: data.items.create, createdAt: new Date(), updatedAt: new Date() }; return savedOrder;
        } },
      }); } finally { release(); }
    },
  };
  await test('Concurrent identical checkouts create exactly one order', async () => {
    const results = await Promise.all([createOrder(orderInput, parallelClient), createOrder(orderInput, parallelClient)]);
    assert.equal(createdCount, 1); assert.equal(results[0].order.id, results[1].order.id);
    assert.equal(results.filter(result => result.isExisting).length, 1); assert.ok(lockCount >= 2);
  });
  await test('Paid order retry does not create another order', async () => {
    savedOrder.paymentStatus = 'PAID';
    assert.equal((await createOrder(orderInput, parallelClient)).isExisting, true); assert.equal(createdCount, 1);
  });
  await test('Retry key cannot silently reuse a different cart', () => assert.rejects(createOrder({ ...orderInput, items: [{ slug: 'business-cards', quantity: 250 }] }, parallelClient), error => error.statusCode === 409));
  await test('Proof coupon claim counts pending online reservations', async () => {
    const coupon = { id: 'coupon', code: 'STAR10', isActive: true, type: 'percentage', value: 10, maxUses: 1, usedCount: 0 };
    const tx = { $queryRaw: async () => [], discount: { findUnique: async () => coupon, update: unexpected }, order: { count: async () => 1 } };
    await assert.rejects(integrity.claimOrderCoupon(tx, { subtotal: 100, discount: 10, couponApplied: { code: 'STAR10' } }, 'PAY_AFTER_PROOF'), error => error.statusCode === 409);
  });
  await test('Coupon price changes require a fresh checkout quote', async () => {
    const coupon = { id: 'coupon', code: 'STAR10', isActive: true, type: 'percentage', value: 20, maxUses: 1, usedCount: 0 };
    const tx = { $queryRaw: async () => [], discount: { findUnique: async () => coupon, update: unexpected } };
    await assert.rejects(integrity.claimOrderCoupon(tx, { subtotal: 100, discount: 10, couponApplied: { code: 'STAR10' } }, 'ONLINE'), error => error.statusCode === 409);
  });
  await test('Only one concurrent proof order claims the final coupon use', async () => {
    const coupon = { id: 'coupon', code: 'STAR10', isActive: true, type: 'percentage', value: 10, maxUses: 1, usedCount: 0 };
    let couponTail = Promise.resolve();
    const claim = async () => { const previous = couponTail; let release; couponTail = new Promise(resolve => { release = resolve; }); await previous;
      try { return await integrity.claimOrderCoupon({ $queryRaw: async () => [], discount: {
        findUnique: async () => coupon, update: async () => { coupon.usedCount++; },
      }, order: { count: async () => 0 } }, { subtotal: 100, discount: 10, couponApplied: { code: 'STAR10' } }, 'PAY_AFTER_PROOF'); } finally { release(); }
    };
    const results = await Promise.allSettled([claim(), claim()]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(coupon.usedCount, 1);
  });
  await test('Reopening cancelled order re-reserves inventory', async () => {
    let stock = 5;
    const row = { id: 'cancelled', status: 'CANCELLED', stockRestoredAt: new Date(), paymentStatus: 'EXPIRED', notes: '[coupon:STAR10]', items: [{ productId: 'product', quantity: 2 }] };
    const tx = { $queryRaw: async () => [], order: { findUnique: async () => row, update: async ({ data }) => { Object.assign(row, data); return row; } }, product: {
      findUnique: async () => ({ id: 'product', trackInventory: true }),
      updateMany: async ({ where, data }) => { if (stock < where.stockQuantity.gte) return { count: 0 }; stock -= data.stockQuantity.decrement; return { count: 1 }; },
    } };
    const result = await updateOrderStatus('cancelled', 'CONFIRMED', { notes: 'Reopened' }, { $transaction: async callback => callback(tx) });
    assert.equal(result.success, true); assert.equal(stock, 3); assert.equal(row.stockRestoredAt, null); assert.equal(row.paymentStatus, 'UNPAID'); assert.equal(row.notes, 'Reopened [coupon:STAR10]');
  });
  await test('Manual order rejects insufficient tracked inventory', async () => {
    let created = false;
    database.$transaction = async callback => callback({ product: {
      findUnique: async () => ({ id: 'product', trackInventory: true }), updateMany: async () => ({ count: 0 }),
    }, order: { create: async () => { created = true; } } });
    await assert.rejects(createAdminOrder({ customerName: 'Test', customerPhone: '9876543210', items: [{ productId: 'product', productName: 'Card', quantity: 10, unitPrice: 100 }] }, 'admin@example.test'), error => error.statusCode === 409);
    assert.equal(created, false);
  });
  const { isOrderOwner } = require('../src/lib/order-access.ts');
  await test('Unverified email cannot claim guest orders', () => assert.equal(isOrderOwner({ userId: null, guestEmail: 'customer@example.test' }, { id: 'customer', email: 'customer@example.test' }), false));
  await test('Verified email can recover its guest orders', () => assert.equal(isOrderOwner({ userId: null, guestEmail: 'CUSTOMER@example.test' }, { id: 'customer', email: 'customer@example.test', email_confirmed_at: '2026-01-01' }), true));
  await test('Customer cannot cancel someone else’s guest order', async () => {
    database.order.findFirst = async () => ({ id: 'guest-order', userId: null, guestEmail: 'other@example.test', status: 'PENDING' });
    const response = await require('../src/app/api/account/orders/[id]/cancel/route.ts').POST(request('/api/account/orders/guest-order/cancel', { reason: 'test' }), { params: { id: 'guest-order' } });
    assert.equal(response.status, 403);
  });
  await test('Guest payment recovery requires authentication', async () => {
    const resolver = require('../src/lib/auth-resolver.ts'); const previous = resolver.resolveUser;
    resolver.resolveUser = async () => null;
    try {
      const response = await require('../src/app/api/payments/razorpay/retry/route.ts').POST(request('/api/payments/razorpay/retry', { orderId: 'guest-order' }));
      assert.equal(response.status, 401);
    } finally { resolver.resolveUser = previous; }
  });
  await test('Customer cancellation rechecks production stage inside lock', async () => {
    const response = await updateOrderStatus('order', 'CANCELLED', { customerCancellation: true }, {
      $transaction: async callback => callback({ $queryRaw: async () => [], order: { findUnique: async () => ({ status: 'IN_PRODUCTION' }) } }),
    });
    assert.equal(response.success, false);
  });
  await test('Zero-balance order is settled server-side and claims coupon once', async () => {
    let uses = 0;
    const coupon = { id: 'free', code: 'FREE', type: 'percentage', value: 100, isActive: true, usedCount: 0, maxUses: null };
    const discount = { findUnique: async () => coupon, update: async () => { uses++; } };
    const zeroClient = { product: { findFirst: async () => null }, discount,
      $transaction: async callback => callback({ $queryRaw: async () => [], discount,
        product: { findFirst: async () => null }, order: { create: async ({ data }) => ({ ...data, id: 'free-order', items: data.items.create, createdAt: new Date(), updatedAt: new Date() }) },
      }),
    };
    const result = await createOrder({ ...orderInput, idempotencyKey: undefined, couponCode: 'FREE' }, zeroClient);
    assert.equal(result.order.totalAmount, 0); assert.equal(result.order.paymentStatus, 'PAID');
    assert.equal(result.order.status, 'CONFIRMED'); assert.equal(result.order.paymentExpiresAt, null); assert.equal(uses, 1);
  });
  await test('Late capture upgrades FAILED ledger entry without duplicate insert', async () => {
    let updates = 0;
    const row = { id: 'order', orderNumber: 'SP-TEST', totalAmount: 100, razorpayOrderId: 'order_expected', paymentStatus: 'UNPAID', status: 'PENDING', notes: null, items: [], shippingAddress: {} };
    const client = {
      paymentTransaction: { findFirst: async () => ({ id: 'ledger', orderId: 'order', status: 'FAILED' }) },
      $transaction: async callback => callback({ $queryRaw: async () => [], order: {
        findUnique: async () => row, update: async ({ data }) => Object.assign(row, data),
      }, paymentTransaction: { update: async () => { updates++; return {}; }, create: unexpected } }),
    };
    const result = await recordPaymentSuccess({ orderId: 'order', paymentId: 'pay_real', razorpayOrderId: 'order_expected', amount: 100 }, client);
    assert.equal(result.success, true); assert.equal(updates, 1); assert.equal(row.paymentStatus, 'PAID');
  });
  const { addressSchema, profileSchema } = require('../src/lib/validation/account.ts');
  await test('Address rejects objects and truncated PIN codes', () => {
    assert.equal(addressSchema.safeParse({ line1: {}, city: 'Test', state: 'Test', pincode: '262308999', phone: '9876543210' }).success, false);
  });
  await test('Profile rejects oversized and non-string fields', () => {
    assert.equal(profileSchema.safeParse({ name: {} }).success, false);
    assert.equal(profileSchema.safeParse({ name: 'x'.repeat(101) }).success, false);
  });
  const { productUpdateSchema } = require('../src/lib/validation/admin-product.ts');
  await test('Product rejects negative price and fractional stock', () => {
    assert.equal(productUpdateSchema.safeParse({ basePrice: -1 }).success, false);
    assert.equal(productUpdateSchema.safeParse({ stockQuantity: 1.5 }).success, false);
  });
  const { customInquirySchema } = require('../src/lib/validation/inquiries.ts');
  await test('Public inquiry strips impersonated user ID', () => {
    const parsed = customInquirySchema.parse({ name: 'Test', phone: '9876543210', email: 'test@example.test', productType: 'Cards', userId: 'another-user' });
    assert.equal(parsed.userId, undefined);
  });
  const { verifyAdminAccess } = require('../src/lib/admin/auth-check.ts');
  database.user = { findFirst: async () => ({ id: 'customer', role: 'CUSTOMER' }) };
  require('../src/lib/auth-resolver.ts').resolveUser = async () => ({ id: 'customer', email: 'admin@example.test', role: 'ADMIN', app_metadata: { role: 'ADMIN' }, email_confirmed_at: '2026-01-01' });
  await test('Revoked DB administrator cannot use stale session privileges', async () => {
    assert.equal((await verifyAdminAccess()).authorized, false);
  });
  database.user.findFirst = unexpected;
  await test('Admin authorization fails closed on database outage', async () => {
    const result = await verifyAdminAccess(); assert.equal(result.authorized, false); assert.equal(result.status, 503);
  });
  const { updateAdminProduct, deleteAdminProduct } = require('../src/server/products.ts');
  database.$transaction = unexpected;
  await test('Product update outage propagates without local fallback', () => assert.rejects(updateAdminProduct('test', { name: 'Test' }, 'admin@example.test'), /could not be saved/));
  await test('Product archive outage propagates without local fallback', () => assert.rejects(deleteAdminProduct('test', 'admin@example.test'), /could not be saved/));
  await test('Image sync failure rolls back product fields', async () => {
    let name = 'Original';
    database.$transaction = async callback => {
      try { return await callback({
        product: { findFirst: async () => ({ id: 'p', name }), update: async ({ data }) => { name = data.name; return { id: 'p', name }; } },
        productImage: { deleteMany: async () => {}, createMany: unexpected },
      }); } catch (error) { name = 'Original'; throw error; }
    };
    await assert.rejects(updateAdminProduct('p', { name: 'Changed', images: [{ url: 'https://example.test/image.png' }] }, 'admin@example.test'), /could not be saved/);
    assert.equal(name, 'Original');
  });
  console.log(`\n${count} offline regression checks passed.`);
}
if (process.argv[2]) {
  const allowed = ['test-quote', 'test-inventory', 'test-refund-accounting', 'test-checkout-auth-security', 'test-ordering-system', 'test-razorpay-production-readiness'];
  if (!allowed.includes(process.argv[2])) throw new Error('Unapproved integration test');
  if (process.argv[2] === 'test-checkout-auth-security') {
    stub('../src/lib/auth-resolver.ts', { resolveUser: async () => null });
  }
  if (['test-ordering-system', 'test-quote'].includes(process.argv[2])) {
    database.product = { findFirst: async () => null };
    database.discount = { findUnique: async ({ where }) => ['STAR10', 'PRESS20'].includes(where.code) ? {
      code: where.code, isActive: true, type: 'percentage', value: where.code === 'STAR10' ? 10 : 20,
      minOrderAmount: where.code === 'PRESS20' ? 1500 : 0,
    } : null };
  }
  require('./' + process.argv[2] + '.ts');
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
