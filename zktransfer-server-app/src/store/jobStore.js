import fs from "node:fs/promises";
import path from "node:path";

async function ensureStoreFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          users: {},
          requests: {},
          transactions: {},
          profiles: {},
          socialRecoveryAccounts: {},
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

export class JobStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async init() {
    await ensureStoreFile(this.filePath);
  }

  async read() {
    await this.init();
    const raw = await fs.readFile(this.filePath, "utf8");
    const data = JSON.parse(raw);
    data.users ||= {};
    data.requests ||= {};
    data.transactions ||= {};
    data.profiles ||= {};
    data.socialRecoveryAccounts ||= {};
    return data;
  }

  async write(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async mutate(mutator) {
    this.queue = this.queue.then(async () => {
      const data = await this.read();
      const result = await mutator(data);
      await this.write(data);
      return result;
    });
    return this.queue;
  }

  async upsertUser(user) {
    return this.mutate((data) => {
      data.users[user.userId] = user;
      return user;
    });
  }

  async upsertProfile(profile) {
    return this.mutate((data) => {
      data.profiles[profile.userId] = profile;
      return profile;
    });
  }

  async getUser(userId) {
    const data = await this.read();
    return data.users[userId] || null;
  }

  async getProfile(userId) {
    const data = await this.read();
    return data.profiles[userId] || null;
  }

  async createRequest(request) {
    return this.mutate((data) => {
      data.requests[request.requestId] = request;
      return request;
    });
  }

  async updateRequest(requestId, patch) {
    return this.mutate((data) => {
      const current = data.requests[requestId];
      if (!current) {
        throw new Error("request not found");
      }
      data.requests[requestId] = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString()
      };
      return data.requests[requestId];
    });
  }

  async getRequest(requestId) {
    const data = await this.read();
    return data.requests[requestId] || null;
  }

  async listRequestsByUser(userId) {
    const data = await this.read();
    return Object.values(data.requests)
      .filter((request) => request.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async createTransaction(transaction) {
    return this.mutate((data) => {
      data.transactions[transaction.txHash] = transaction;
      return transaction;
    });
  }

  async upsertSocialRecoveryAccount(account) {
    return this.mutate((data) => {
      data.socialRecoveryAccounts[account.accountId] = account;
      return account;
    });
  }

  async getSocialRecoveryAccount(accountId) {
    const data = await this.read();
    return data.socialRecoveryAccounts[accountId] || null;
  }

  async listSocialRecoveryAccounts() {
    const data = await this.read();
    return Object.values(data.socialRecoveryAccounts).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    );
  }

  async getTransaction(txHash) {
    const data = await this.read();
    return data.transactions[txHash] || null;
  }

  async listTransactions() {
    const data = await this.read();
    return Object.values(data.transactions).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    );
  }
}
