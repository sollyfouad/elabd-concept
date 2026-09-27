import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPhone, toLatinDigits, toPageDigits, summaryRows, demoOrderNumber, confirmationRows } from '../src/lib/checkout-core.js';

test('toLatinDigits converts Arabic-Indic digits and leaves others alone', () => {
  assert.equal(toLatinDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  assert.equal(toLatinDigits('01x'), '01x');
});

test('isValidPhone accepts 8-15 digits in either script, with spaces/dashes/+', () => {
  for (const ok of ['01012345678', '٠١٠١٢٣٤٥٦٧٨', '+20 101 234 5678', '010-1234-5678', '17111000']) {
    assert.ok(isValidPhone(ok), ok);
  }
  for (const bad of ['', '   ', '1234567', '0101234567890123', 'abc01012345678', '010.123.45678']) {
    assert.ok(!isValidPhone(bad), bad);
  }
});

const strings = {
  sum_name: 'Name', sum_phone: 'Mobile', sum_method: 'Method', sum_address: 'Address', sum_branch: 'Branch',
  sum_time: 'Time', sum_payment: 'Payment', method_delivery: 'Delivery', method_pickup: 'Pickup',
};
const t = (k) => strings[k];
const lists = { branches: ['Branch A', 'Branch B'], slots: ['9 AM – 12 PM', '12 – 3 PM'], payments: ['Cash', 'Card', 'InstaPay'] };
const entry = {
  name: ' Mona ', phone: '010 1234 5678', method: 'delivery',
  address: { area: 'Dokki', street: 'Street 9', building: '12', landmark: '' },
  branchIndex: null, slotIndex: 1, paymentIndex: 2,
};

test('summaryRows echoes name, phone, address, time and payment for delivery', () => {
  assert.deepEqual(summaryRows(entry, t, lists, 'en'), [
    ['Name', 'Mona'], ['Mobile', '010 1234 5678'], ['Method', 'Delivery'],
    ['Address', 'Dokki, Street 9, 12'], ['Time', '12 – 3 PM'], ['Payment', 'InstaPay'],
  ]);
});

test('summaryRows shows the branch for pickup, and Arabic-Indic digits on Arabic pages', () => {
  const rows = summaryRows({ ...entry, method: 'pickup', branchIndex: 1 }, t, lists, 'ar');
  assert.deepEqual(rows[1], ['Mobile', '٠١٠ ١٢٣٤ ٥٦٧٨']);
  assert.deepEqual(rows[3], ['Branch', 'Branch B']);
  const arAddress = summaryRows(entry, t, lists, 'ar')[3][1];
  assert.equal(arAddress, 'Dokki، Street ٩، ١٢');
  assert.equal(toPageDigits('Building 12', 'en'), 'Building 12');
});

test('demoOrderNumber is "DEMO-" + 4 digits, zero-padded, in the page digits', () => {
  for (let i = 0; i < 50; i++) assert.match(demoOrderNumber('en'), /^DEMO-\d{4}$/);
  assert.match(demoOrderNumber('ar'), /^DEMO-[٠-٩]{4}$/);
  assert.equal(demoOrderNumber('en', () => 0), 'DEMO-0000');
  assert.equal(demoOrderNumber('en', () => 0.0427), 'DEMO-0427');
  assert.equal(demoOrderNumber('ar', () => 0.9999), 'DEMO-٩٩٩٩');
});

test('confirmationRows: order number, item count, total, method, then branch (pickup only) and time', () => {
  const tc = (k) => ({ order_no: 'Order', item_count: 'Items', total: 'Total', ...strings })[k];
  const base = { orderNo: 'DEMO-0427', count: 13, total: '650 EGP', slot: '12 – 3 PM' };
  assert.deepEqual(confirmationRows({ ...base, method: 'delivery', branch: null }, tc, 'en'), [
    ['Order', 'DEMO-0427'], ['Items', '13'], ['Total', '650 EGP'], ['Method', 'Delivery'], ['Time', '12 – 3 PM'],
  ]);
  const pickup = confirmationRows({ ...base, method: 'pickup', branch: 'Branch B' }, tc, 'ar');
  assert.deepEqual(pickup.slice(1, 2), [['Items', '١٣']]);
  assert.deepEqual(pickup.slice(3), [['Method', 'Pickup'], ['Branch', 'Branch B'], ['Time', '12 – 3 PM']]);
});
