// receiptService normalisation, with Gemini and Google auth mocked
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getProjectId: async () => 'test-project',
    getClient: async () => ({ getAccessToken: async () => ({ token: 'test-token' }) }),
  })),
}));

const { recognizeReceipt } = require('../src/services/receiptService');

const geminiReturns = (parsed) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      modelVersion: 'gemini-test',
      candidates: [{ content: { parts: [{ text: JSON.stringify(parsed) }] } }],
    }),
  });
};

describe('recognizeReceipt', () => {
  test('maps printed tax rates to refundRate and leaves it out when unknown', async () => {
    geminiReturns({
      merchant: 'ドラッグストア', date: '2026-11-03', currency: 'JPY', total: 1640, adjustments: [],
      items: [
        { name: '面膜', quantity: 1, amount: 1100, taxRate: 10 },
        { name: '抹茶餅乾', quantity: 1, amount: 540, taxRate: 8 },
      ],
    });
    const result = await recognizeReceipt('aW1n', 'image/jpeg');
    expect(result.items.map(i => i.refundRate)).toEqual([10, 8]);
    expect(result.taxRefund).toBe(0);
    expect(result.difference).toBe(0);

    geminiReturns({ currency: 'TWD', total: 100, adjustments: [], items: [{ name: '炒飯', quantity: 1, amount: 100, taxRate: null }] });
    const plain = await recognizeReceipt('aW1n', 'image/jpeg');
    expect(plain.items[0].refundRate).toBeUndefined();
  });

  test('a tax-free deduction on the receipt counts towards the total check', async () => {
    geminiReturns({
      currency: 'JPY', total: 1000, adjustments: [], taxRefund: 100,
      items: [{ name: '面膜', quantity: 1, amount: 1100, taxRate: 10 }],
    });
    const result = await recognizeReceipt('aW1n', 'image/jpeg');
    expect(result.taxRefund).toBe(100);
    expect(result.difference).toBe(0);
  });

  test('asks Gemini for tax rates and tax-free deductions', async () => {
    geminiReturns({ currency: 'TWD', total: 100, adjustments: [], items: [{ name: 'A', quantity: 1, amount: 100 }] });
    await recognizeReceipt('aW1n', 'image/jpeg');
    const request = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(request.contents[0].parts[1].text).toMatch(/taxRate/);
    expect(request.generationConfig.responseSchema.properties.taxRefund).toBeDefined();
  });
});
