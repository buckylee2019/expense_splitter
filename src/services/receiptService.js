// Receipt recognition with Gemini on Vertex AI.
//
// Sends a receipt photo to Gemini with a response schema and gets back the
// line items, adjustments (service charge, discounts, …) and total. Runs as the
// Cloud Run service account, which needs roles/aiplatform.user on the project.

const { GoogleAuth } = require('google-auth-library');

const MODEL = process.env.RECEIPT_MODEL || 'gemini-3.8-flash';
const LOCATION = process.env.RECEIPT_MODEL_LOCATION || 'global';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

const ADJUSTMENT_TYPES = ['service_charge', 'tax', 'discount', 'rounding', 'other'];

// Language for item names and adjustment labels. 'original' keeps them as printed;
// otherwise they are translated and the printed text is kept in originalName/originalLabel.
const ITEM_LANGUAGES = {
  original: null,
  'zh-TW': 'Traditional Chinese as used in Taiwan',
  en: 'English',
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    merchant: { type: 'STRING', nullable: true, description: 'Store or restaurant name' },
    date: { type: 'STRING', nullable: true, description: 'Purchase date as YYYY-MM-DD' },
    currency: { type: 'STRING', description: 'ISO 4217 code, e.g. TWD' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Item name, in the requested language' },
          originalName: { type: 'STRING', nullable: true, description: 'Item name exactly as printed' },
          quantity: { type: 'NUMBER', description: 'Quantity, 1 if not shown' },
          amount: { type: 'NUMBER', description: 'Line total for this item (after quantity)' },
        },
        required: ['name', 'quantity', 'amount'],
      },
    },
    adjustments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ADJUSTMENT_TYPES },
          label: { type: 'STRING', description: 'Label in the requested language, e.g. 服務費 10%' },
          originalLabel: { type: 'STRING', nullable: true, description: 'Label exactly as printed' },
          amount: { type: 'NUMBER', description: 'Amount; negative for discounts' },
        },
        required: ['type', 'label', 'amount'],
      },
    },
    total: { type: 'NUMBER', description: 'Final amount paid' },
  },
  required: ['currency', 'items', 'adjustments', 'total'],
};

const PROMPT_TEMPLATE = `You are reading a photo of a shop or restaurant receipt (often Taiwanese, in Traditional Chinese).
Extract it into the JSON schema.

Rules:
- items: every purchased line item. "amount" is the line total (quantity × unit price), as printed for that line.
  {{NAMES}} Do not include subtotal, total, payment, change,
  card, invoice-number or tax-ID lines as items.
- adjustments: lines that change the bill after the items — service charge (服務費), discounts (折扣, 折價, 優惠,
  會員折扣) as NEGATIVE amounts, separately added tax, rounding. Do not add a tax adjustment when prices already
  include tax (Taiwanese receipts usually say 含稅 / 內含).
- total: the final amount actually due (總計 / 合計 / 應付 / Total), not the amount tendered.
- currency: TWD for NT$, 元, 新台幣 or a Taiwanese receipt with no currency shown.
- date: YYYY-MM-DD; convert ROC years (e.g. 115年) to Gregorian (2026). null if not shown.
- Read amounts carefully: in a tilted photo, match each amount to the item on the same printed line.
- If the image is not a receipt, return empty items and adjustments and total 0.`;

const buildPrompt = (itemLanguage) => {
  const language = ITEM_LANGUAGES[itemLanguage];
  const names = language
    ? `Write each item "name" and adjustment "label" in ${language}: a short, natural name people would recognise
  (keep brand names, sizes and counts such as 1857ml or x2 as they are). Put the text exactly as printed in
  "originalName" / "originalLabel". If the printed text is already in ${language}, use it unchanged for both.`
    : `Keep each item name and adjustment label exactly as printed (do not translate); set originalName and
  originalLabel to null.`;
  return PROMPT_TEMPLATE.replace('{{NAMES}}', names);
};

class ReceiptRecognitionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * @param {string} imageBase64  image bytes, base64 (no data: prefix)
 * @param {string} mimeType     e.g. image/jpeg
 * @param {{itemLanguage?: keyof ITEM_LANGUAGES}} [options]
 * @returns {Promise<{merchant, date, currency, items, adjustments, total, itemsTotal, difference, model}>}
 */
async function recognizeReceipt(imageBase64, mimeType = 'image/jpeg', { itemLanguage = 'original' } = {}) {
  const projectId = process.env.GCP_PROJECT_ID || (await auth.getProjectId());
  const host = LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${LOCATION}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;

  const client = await auth.getClient();
  const { token } = await client.getAccessToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: buildPrompt(itemLanguage) },
        ],
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ReceiptRecognitionError('MODEL_ERROR', body.error?.message || `Gemini request failed (${response.status})`);
  }
  const text = body.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ReceiptRecognitionError('BAD_RESPONSE', 'Could not read the recognition result');
  }

  // Keep the printed text only when it was translated into something different
  const original = (translated, printed) => {
    const text = ITEM_LANGUAGES[itemLanguage] && printed ? String(printed).trim() : '';
    return text && text !== translated ? text : undefined;
  };
  const items = (parsed.items || [])
    .filter(item => item && item.name)
    .map(item => {
      const name = String(item.name).trim();
      return {
        name,
        originalName: original(name, item.originalName),
        quantity: Number(item.quantity) || 1,
        amount: round2(item.amount),
      };
    });
  const adjustments = (parsed.adjustments || [])
    .filter(adj => adj && Number.isFinite(Number(adj.amount)) && Number(adj.amount) !== 0)
    .map(adj => {
      const label = String(adj.label || '').trim();
      return {
        type: ADJUSTMENT_TYPES.includes(adj.type) ? adj.type : 'other',
        label,
        originalLabel: original(label, adj.originalLabel),
        amount: round2(adj.amount),
      };
    });
  const total = round2(parsed.total);
  const itemsTotal = round2(items.reduce((sum, item) => sum + item.amount, 0));
  const adjustmentsTotal = round2(adjustments.reduce((sum, adj) => sum + adj.amount, 0));

  if (items.length === 0) {
    throw new ReceiptRecognitionError('NO_ITEMS', 'No items found on this image');
  }

  return {
    merchant: parsed.merchant || null,
    date: parsed.date || null,
    currency: (parsed.currency || 'TWD').toUpperCase(),
    items,
    adjustments,
    total,
    itemsTotal,
    // Non-zero means the items and adjustments don't add up to the total (misread or missing line)
    difference: round2(total - itemsTotal - adjustmentsTotal),
    model: body.modelVersion || MODEL,
  };
}

module.exports = { recognizeReceipt, ReceiptRecognitionError, ITEM_LANGUAGES };
