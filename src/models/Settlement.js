const { Filter } = require('@google-cloud/firestore');
const { db } = require('../config/firestore');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'settlements';

class Settlement {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.from = data.from;
    this.to = data.to;
    this.amount = data.amount;
    this.currency = data.currency || 'TWD';
    this.group = data.group;
    this.method = data.method || 'cash';
    this.notes = data.notes;
    this.settledAt = data.settledAt || new Date().toISOString();
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.recordedBy = data.recordedBy;
    this.isMultiGroupSettlement = data.isMultiGroupSettlement || false;
  }

  static async create(settlementData) {
    const settlement = new Settlement(settlementData);

    await db.collection(COLLECTION).doc(settlement.id).set({ ...settlement });
    return settlement;
  }

  static async findById(id) {
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return new Settlement(doc.data());
  }

  static async findByUserId(userId) {
    const snapshot = await db.collection(COLLECTION)
      .where(Filter.or(
        Filter.where('from', '==', userId),
        Filter.where('to', '==', userId),
        Filter.where('recordedBy', '==', userId)
      ))
      .get();
    const filtered = snapshot.docs.map(doc => doc.data());

    console.log(`Finding settlements for user: ${userId}`);
    console.log(`Found ${filtered.length} settlements`);

    return Settlement.withUserNames(filtered);
  }

  static async findByGroupId(groupId) {
    const snapshot = await db.collection(COLLECTION)
      .where('group', '==', groupId)
      .get();

    const items = [];
    snapshot.forEach(doc => items.push(doc.data()));

    return Settlement.withUserNames(items);
  }

  // Attach fromName/toName, fetching each distinct user once
  static async withUserNames(items) {
    const settlements = items.map(item => new Settlement(item));

    const User = require('./User');
    let users = new Map();
    try {
      users = await User.findByIds(settlements.flatMap(s => [s.from, s.to]));
    } catch (err) {
      console.error('Error fetching user details for settlements:', err);
    }

    settlements.forEach(settlement => {
      if (settlement.from) {
        const fromUser = users.get(settlement.from);
        settlement.fromName = fromUser?.name || fromUser?.email || settlement.from;
      }
      if (settlement.to) {
        const toUser = users.get(settlement.to);
        settlement.toName = toUser?.name || toUser?.email || settlement.to;
      }
    });

    return settlements;
  }

  async save() {
    this.updatedAt = new Date().toISOString();

    await db.collection(COLLECTION).doc(this.id).set({ ...this });
    return this;
  }

  async update() {
    return this.save();
  }

  async delete() {
    await db.collection(COLLECTION).doc(this.id).delete();
    return true;
  }

  static async deleteById(id) {
    await db.collection(COLLECTION).doc(id).delete();
    return true;
  }
}

module.exports = Settlement;
