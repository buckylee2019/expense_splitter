// Route tests for itemized expenses and receipt scanning. Firestore, GCS, auth
// and Gemini are mocked, so only the route logic is exercised.
const express = require('express');
const request = require('supertest');

jest.mock('../src/config/firestore', () => ({ db: {} }));
jest.mock('../src/utils/auth', () => ({
  authMiddleware: (req, res, next) => { req.user = { id: 'amy' }; next(); },
}));
jest.mock('../src/models/Group');
jest.mock('../src/models/Expense');
jest.mock('../src/models/User');
jest.mock('../src/utils/gcs', () => ({
  validateImage: jest.fn(),
  uploadReceipt: jest.fn(),
  openReceipt: jest.fn(),
}));
jest.mock('../src/services/receiptService', () => {
  class ReceiptRecognitionError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  return { recognizeReceipt: jest.fn(), ReceiptRecognitionError, ITEM_LANGUAGES: { original: null, 'zh-TW': 'zh', en: 'en' } };
});

const Group = require('../src/models/Group');
const Expense = require('../src/models/Expense');
const User = require('../src/models/User');
const gcs = require('../src/utils/gcs');
const { recognizeReceipt, ReceiptRecognitionError } = require('../src/services/receiptService');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/expenses', require('../src/routes/expenses'));
app.use('/api/receipts', require('../src/routes/receipts'));

const group = { id: 'g1', members: [{ user: 'amy' }, { user: 'ben' }, { user: 'cindy' }] };
const items = [
  { name: '炒飯', quantity: 1, amount: 300, assignees: ['amy'] },
  { name: '啤酒', quantity: 3, amount: 700, assignees: ['ben'] },
];
const baseBody = {
  description: '好味小館', amount: 1100, currency: 'TWD', category: 'food', groupId: 'g1',
  paidBy: 'amy', splitType: 'itemized', items,
  adjustments: [{ type: 'service_charge', label: '服務費 10%', amount: 100 }],
  splits: [{ userId: 'amy', amount: 1100 }], // client splits must be ignored
};

beforeEach(() => {
  jest.clearAllMocks();
  Group.findByUserIdAndGroupId.mockImplementation(async (userId, groupId) => (groupId === 'g1' ? group : null));
  Expense.create.mockImplementation(async (data) => ({ id: 'e1', ...data }));
  Expense.update.mockImplementation(async (id, data) => ({ id, ...data }));
  User.findByIds.mockResolvedValue(new Map());
});

const byUser = (splits) => Object.fromEntries(splits.map(s => [s.userId, s.amount]));

describe('POST /api/expenses (itemized)', () => {
  test('derives splits from items, sharing the service charge pro rata', async () => {
    const res = await request(app).post('/api/expenses').send({
      ...baseBody, receipt: { key: 'receipts/g1/123-abc.jpg', merchant: '好味小館', model: 'gemini-3.8-flash' },
    });
    expect(res.status).toBe(201);
    const saved = Expense.create.mock.calls[0][0];
    expect(byUser(saved.splits)).toEqual({ amy: 330, ben: 770 });
    expect(saved.items).toHaveLength(2);
    expect(saved.adjustments[0].amount).toBe(100);
    expect(saved.receipt.key).toBe('receipts/g1/123-abc.jpg');
  });

  test('rejects an item assigned to someone outside the group', async () => {
    const res = await request(app).post('/api/expenses').send({
      ...baseBody, items: [{ ...items[0], assignees: ['mallory'] }, items[1]],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_A_MEMBER');
    expect(Expense.create).not.toHaveBeenCalled();
  });

  test('rejects items that do not add up to the amount', async () => {
    const res = await request(app).post('/api/expenses').send({ ...baseBody, amount: 1200 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOTAL_MISMATCH');
  });

  test('drops a receipt key that belongs to another group', async () => {
    const res = await request(app).post('/api/expenses').send({
      ...baseBody, receipt: { key: 'receipts/other-group/1.jpg' },
    });
    expect(res.status).toBe(201);
    expect(Expense.create.mock.calls[0][0].receipt).toBeNull();
  });

  test('non-itemized expenses are unchanged', async () => {
    const res = await request(app).post('/api/expenses').send({
      ...baseBody, splitType: 'equal', items: undefined, adjustments: undefined,
      splits: [{ userId: 'amy', amount: 550 }, { userId: 'ben', amount: 550 }],
    });
    expect(res.status).toBe(201);
    const saved = Expense.create.mock.calls[0][0];
    expect(byUser(saved.splits)).toEqual({ amy: 550, ben: 550 });
    expect(saved.items).toEqual([]);
  });
});

describe('PUT /api/expenses/:id', () => {
  const existing = {
    id: 'e1', group: 'g1', amount: 1100, currency: 'TWD', splitType: 'itemized',
    items, adjustments: baseBody.adjustments, receipt: { key: 'receipts/g1/123-abc.jpg' },
    splits: [{ userId: 'amy', amount: 330 }, { userId: 'ben', amount: 770 }],
  };
  beforeEach(() => Expense.findByUserIdAndExpenseId.mockResolvedValue(existing));

  test('re-assigning items recomputes the splits', async () => {
    const res = await request(app).put('/api/expenses/e1').send({
      items: [{ ...items[0], assignees: ['amy', 'cindy'] }, items[1]],
    });
    expect(res.status).toBe(200);
    const update = Expense.update.mock.calls[0][1];
    expect(byUser(update.splits)).toEqual({ amy: 165, cindy: 165, ben: 770 });
    expect(update.receipt.key).toBe('receipts/g1/123-abc.jpg');
  });

  test('switching to an equal split clears the item assignments but keeps the photo', async () => {
    const res = await request(app).put('/api/expenses/e1').send({
      splitType: 'equal', amount: 1100,
      splits: [{ userId: 'amy', amount: 550 }, { userId: 'ben', amount: 550 }],
    });
    expect(res.status).toBe(200);
    const update = Expense.update.mock.calls[0][1];
    expect(update.splitType).toBe('equal');
    expect(update.items).toEqual([]);
    expect(byUser(update.splits)).toEqual({ amy: 550, ben: 550 });
    expect(update.receipt.key).toBe('receipts/g1/123-abc.jpg');
  });
});

describe('POST /api/receipts/scan', () => {
  const image = 'data:image/jpeg;base64,' + Buffer.from('fake').toString('base64');
  const recognized = {
    merchant: '好味小館', date: '2026-11-05', currency: 'TWD', items, adjustments: [], total: 1000,
    itemsTotal: 1000, difference: 0, model: 'gemini-3.8-flash',
  };

  test('recognizes, then stores the photo privately', async () => {
    gcs.validateImage.mockReturnValue({ isValid: true, contentType: 'image/jpeg' });
    recognizeReceipt.mockResolvedValue(recognized);
    gcs.uploadReceipt.mockResolvedValue('receipts/g1/1-x.jpg');
    const res = await request(app).post('/api/receipts/scan').send({ groupId: 'g1', image });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.receipt.key).toBe('receipts/g1/1-x.jpg');
    expect(gcs.uploadReceipt).toHaveBeenCalledWith(expect.any(Buffer), 'g1', 'image/jpeg');
  });

  test('non-members get 404 and nothing is recognized', async () => {
    const res = await request(app).post('/api/receipts/scan').send({ groupId: 'other', image });
    expect(res.status).toBe(404);
    expect(recognizeReceipt).not.toHaveBeenCalled();
  });

  test('invalid images are rejected before calling the model', async () => {
    gcs.validateImage.mockReturnValue({ isValid: false, error: 'Invalid base64 format' });
    const res = await request(app).post('/api/receipts/scan').send({ groupId: 'g1', image: 'nope' });
    expect(res.status).toBe(400);
    expect(recognizeReceipt).not.toHaveBeenCalled();
  });

  test('no items found → 422 and the photo is not stored', async () => {
    gcs.validateImage.mockReturnValue({ isValid: true, contentType: 'image/jpeg' });
    recognizeReceipt.mockRejectedValue(new ReceiptRecognitionError('NO_ITEMS', 'No items found on this image'));
    const res = await request(app).post('/api/receipts/scan').send({ groupId: 'g1', image });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NO_ITEMS');
    expect(gcs.uploadReceipt).not.toHaveBeenCalled();
  });

  test('item language defaults to original and is passed through', async () => {
    gcs.validateImage.mockReturnValue({ isValid: true, contentType: 'image/jpeg' });
    recognizeReceipt.mockResolvedValue(recognized);
    gcs.uploadReceipt.mockResolvedValue('receipts/g1/1-x.jpg');
    await request(app).post('/api/receipts/scan').send({ groupId: 'g1', image });
    expect(recognizeReceipt).toHaveBeenLastCalledWith(expect.any(String), 'image/jpeg', { itemLanguage: 'original' });
    await request(app).post('/api/receipts/scan').send({ groupId: 'g1', image, itemLanguage: 'en' });
    expect(recognizeReceipt).toHaveBeenLastCalledWith(expect.any(String), 'image/jpeg', { itemLanguage: 'en' });
  });

  test('unsupported item language → 400 before calling the model', async () => {
    const res = await request(app).post('/api/receipts/scan').send({ groupId: 'g1', image, itemLanguage: 'klingon' });
    expect(res.status).toBe(400);
    expect(recognizeReceipt).not.toHaveBeenCalled();
  });
});

describe('original names from translated scans', () => {
  test('are kept on save, and untranslated items get no originalName field', async () => {
    const res = await request(app).post('/api/expenses').send({
      ...baseBody,
      items: [{ ...items[0], name: 'Fried rice', originalName: '炒飯' }, items[1]],
      adjustments: [{ type: 'service_charge', label: 'Service charge', originalLabel: '服務費', amount: 100 }],
    });
    expect(res.status).toBe(201);
    const saved = Expense.create.mock.calls[0][0];
    expect(saved.items[0].originalName).toBe('炒飯');
    expect('originalName' in saved.items[1]).toBe(false); // Firestore rejects undefined values
    expect(saved.adjustments[0].originalLabel).toBe('服務費');
  });
});
