const { db } = require('../config/firestore');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'users';

class User {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.email = data.email;
    this.password = data.password;
    this.phone = data.phone || '';
    this.avatar = data.avatar || '';
    this.avatarUrl = data.avatarUrl || null;
    this.friends = data.friends || [];
    this.groups = data.groups || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static async create(userData) {
    console.log('Creating user with data:', { ...userData, password: '[REDACTED]' });

    const user = new User(userData);

    if (user.password) {
      user.password = await bcrypt.hash(user.password, 8);
    }

    // Use a transaction to enforce email uniqueness
    await db.runTransaction(async (t) => {
      const existing = await db.collection(COLLECTION)
        .where('email', '==', user.email)
        .limit(1)
        .get();

      if (!existing.empty) {
        throw new Error('User already exists');
      }

      t.set(db.collection(COLLECTION).doc(user.id), { ...user });
    });

    return user;
  }

  static async findByEmail(email) {
    console.log('Finding user by email:', email);

    const snapshot = await db.collection(COLLECTION)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return new User(snapshot.docs[0].data());
  }

  static async findById(id) {
    console.log('Finding user by ID:', id);

    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return new User(doc.data());
  }

  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  async save() {
    this.updatedAt = new Date().toISOString();

    await db.collection(COLLECTION).doc(this.id).set({ ...this });
    return this;
  }

  toJSON() {
    const user = { ...this };
    delete user.password;
    return user;
  }

  // Search by partial name, or by exact email. Partial email matching is not
  // allowed so the search can't be used to enumerate addresses; emails in the
  // results are masked for the same reason.
  static async search(query, excludeId, limit = 10) {
    const q = query.trim().toLowerCase();
    console.log('Searching users:', { q, excludeId });

    // Firestore doesn't support 'contains' on strings, so fetch all and filter in JS
    const snapshot = await db.collection(COLLECTION).get();
    const results = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.id === excludeId) return;

      const nameMatch = data.name && data.name.toLowerCase().includes(q);
      const emailMatch = data.email && data.email.toLowerCase() === q;
      if (nameMatch || emailMatch) {
        results.push({
          id: data.id,
          name: data.name,
          email: User.maskEmail(data.email),
          avatarUrl: data.avatarUrl || null,
          avatar: data.avatar || ''
        });
      }
    });

    results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    console.log('Search result:', { count: results.length });
    return results.slice(0, limit);
  }

  // "buckylee@example.com" -> "bu******@example.com"
  static maskEmail(email) {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
  }

  static async addToGroup(userId, groupId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.groups.includes(groupId)) {
      user.groups.push(groupId);
      user.updatedAt = new Date().toISOString();
      await db.collection(COLLECTION).doc(user.id).set({ ...user });
    }

    return user;
  }

  static async removeFromGroup(userId, groupId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.groups = user.groups.filter(id => id !== groupId);
    user.updatedAt = new Date().toISOString();
    await db.collection(COLLECTION).doc(user.id).set({ ...user });
    return user;
  }
}

module.exports = User;
