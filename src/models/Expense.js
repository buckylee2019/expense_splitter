const { db } = require('../config/firestore');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'expenses';

class Expense {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.description = data.description;
    this.amount = data.amount;
    this.currency = data.currency || 'TWD';
    this.category = data.category;
    this.paidBy = data.paidBy;
    this.isMultiplePayers = data.isMultiplePayers || false;
    this.group = data.group;
    this.splits = data.splits || [];
    this.splitType = data.splitType;
    this.date = data.date || new Date().toISOString();
    this.notes = data.notes;
    this.project = data.project;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static async create(expenseData) {
    const expense = new Expense(expenseData);

    await db.collection(COLLECTION).doc(expense.id).set({ ...expense });
    return expense;
  }

  static async findById(id) {
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return new Expense(doc.data());
  }

  static async findByUserId(userId) {
    // Fetch all and filter in JS (matches original DynamoDB Scan behavior)
    const snapshot = await db.collection(COLLECTION).get();
    const allExpenses = [];
    snapshot.forEach(doc => allExpenses.push(new Expense(doc.data())));

    return allExpenses.filter(expense => {
      const isPayer = expense.paidBy === userId;
      const isInSplits = expense.splits.some(split =>
        split.user === userId || split.userId === userId
      );
      return isPayer || isInSplits;
    });
  }

  static async findByUserIdAndExpenseId(userId, expenseId) {
    const expense = await Expense.findById(expenseId);
    if (!expense) return null;

    if (expense.group) {
      const Group = require('./Group');
      const group = await Group.findByUserIdAndGroupId(userId, expense.group);
      if (group) {
        return expense;
      }
    }

    const isRelated = expense.paidBy === userId ||
                     expense.splits.some(split =>
                       split.user === userId || split.userId === userId
                     );

    return isRelated ? expense : null;
  }

  static async findByGroupId(groupId) {
    const snapshot = await db.collection(COLLECTION)
      .where('group', '==', groupId)
      .get();

    const expenses = [];
    snapshot.forEach(doc => expenses.push(new Expense(doc.data())));
    return expenses;
  }

  async save() {
    this.updatedAt = new Date().toISOString();

    await db.collection(COLLECTION).doc(this.id).set({ ...this });
    return this;
  }

  static async updateSettlementStatus(expenseIds, userId, settled = true) {
    const updatePromises = expenseIds.map(async (expenseId) => {
      const expense = await Expense.findById(expenseId);
      if (expense) {
        const splitIndex = expense.splits.findIndex(split => split.user === userId);
        if (splitIndex !== -1) {
          expense.splits[splitIndex].settled = settled;
          await expense.save();
        }
      }
    });

    await Promise.all(updatePromises);
  }

  static async update(id, updateData) {
    updateData.updatedAt = new Date().toISOString();
    await db.collection(COLLECTION).doc(id).update(updateData);

    const doc = await db.collection(COLLECTION).doc(id).get();
    return new Expense(doc.data());
  }

  static async delete(id) {
    await db.collection(COLLECTION).doc(id).delete();
  }

  static async findByGroupIdWithFilters(options) {
    const {
      groupId,
      startDate,
      endDate,
      search,
      category,
      minAmount,
      maxAmount,
      sort = 'createdAt',
      order = 'desc',
      limit = 20,
      offset = 0
    } = options;

    // Query by group, then filter in JS (same pattern as original)
    const snapshot = await db.collection(COLLECTION)
      .where('group', '==', groupId)
      .get();

    let items = [];
    snapshot.forEach(doc => items.push(doc.data()));

    // Apply filters
    if (startDate) {
      items = items.filter(item => item.date >= startDate);
    }
    if (endDate) {
      items = items.filter(item => item.date <= endDate);
    }
    if (search) {
      items = items.filter(item =>
        item.description && item.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (category) {
      items = items.filter(item => item.category === category);
    }
    if (minAmount !== undefined) {
      items = items.filter(item => item.amount >= minAmount);
    }
    if (maxAmount !== undefined) {
      items = items.filter(item => item.amount <= maxAmount);
    }

    // Sort
    items.sort((a, b) => {
      const aVal = a[sort];
      const bVal = b[sort];
      if (order === 'desc') {
        return bVal > aVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });

    // Paginate
    const totalCount = items.length;
    const paginatedItems = items.slice(offset, offset + limit);

    return {
      expenses: paginatedItems.map(item => new Expense(item)),
      totalCount
    };
  }

  static async findByUserIdWithPagination(userId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      sort = 'createdAt',
      order = 'desc'
    } = options;

    const snapshot = await db.collection(COLLECTION).get();
    let items = [];
    snapshot.forEach(doc => items.push(doc.data()));

    // Filter by user involvement
    items = items.filter(item => {
      const isPayer = item.paidBy === userId;
      const isInSplits = (item.splits || []).some(split =>
        split.user === userId || split.userId === userId
      );
      return isPayer || isInSplits;
    });

    // Sort
    items.sort((a, b) => {
      const aVal = a[sort];
      const bVal = b[sort];
      if (order === 'desc') {
        return bVal > aVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });

    const totalCount = items.length;
    const paginatedItems = items.slice(offset, offset + limit);

    return {
      expenses: paginatedItems.map(item => new Expense(item)),
      totalCount
    };
  }
}

module.exports = Expense;
