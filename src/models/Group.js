const { db } = require('../config/firestore');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'groups';

class Group {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.description = data.description;
    this.photo = data.photo || null;
    this.photoUrl = data.photoUrl || null;
    this.members = data.members || [];
    this.createdBy = data.createdBy;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static async create(groupData) {
    const group = new Group(groupData);

    await db.collection(COLLECTION).doc(group.id).set({ ...group });
    return group;
  }

  static async findById(id) {
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return new Group(doc.data());
  }

  static async findByUserId(userId) {
    const snapshot = await db.collection(COLLECTION)
      .where('isActive', '==', true)
      .get();

    const groups = [];
    snapshot.forEach(doc => groups.push(new Group(doc.data())));

    // Filter groups where user is a member
    return groups.filter(group =>
      group.members.some(member =>
        typeof member === 'object' ? member.user === userId : member === userId
      )
    );
  }

  static async findByUserIdAndGroupId(userId, groupId) {
    const group = await Group.findById(groupId);
    if (!group) return null;

    const isMember = group.members.some(member =>
      typeof member === 'object' ? member.user === userId : member === userId
    );

    return isMember ? group : null;
  }

  async save() {
    this.updatedAt = new Date().toISOString();

    await db.collection(COLLECTION).doc(this.id).set({ ...this });
    return this;
  }

  addMember(userId, role = 'member') {
    const existingMember = this.members.find(member =>
      typeof member === 'object' ? member.user === userId : member === userId
    );

    if (!existingMember) {
      this.members.push({
        user: userId,
        role: role,
        joinedAt: new Date().toISOString()
      });
    }
  }

  removeMember(userId) {
    this.members = this.members.filter(member =>
      typeof member === 'object' ? member.user !== userId : member !== userId
    );
  }

  isAdmin(userId) {
    const member = this.members.find(member =>
      typeof member === 'object' ? member.user === userId : member === userId
    );
    return member && member.role === 'admin';
  }

  static async addMember(groupId, memberData) {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    group.members.push(memberData);
    group.updatedAt = new Date().toISOString();
    await db.collection(COLLECTION).doc(group.id).set({ ...group });
    return group;
  }

  static async delete(id) {
    await db.collection(COLLECTION).doc(id).delete();
  }
}

module.exports = Group;
