const DEFAULT_PORTFOLIO = [
  {
    assetCode: "erc20-usdc",
    label: "Velora USD",
    tokenType: "ERC20",
    available: "12500",
    privacyReady: "9400"
  },
  {
    assetCode: "erc721-pass",
    label: "Membership NFT",
    tokenType: "ERC721",
    available: "3",
    privacyReady: "2"
  },
  {
    assetCode: "erc1155-points",
    label: "Reward Points",
    tokenType: "ERC1155",
    available: "480",
    privacyReady: "310"
  }
];

const DEFAULT_SETTINGS = {
  autoPrivacyMode: true,
  defaultNetwork: "hardhat-local",
  receiptNameMode: "contact-first",
  marketingPush: false
};

export class ProfileService {
  constructor({ store }) {
    this.store = store;
  }

  async ensureProfile(user) {
    const existing = await this.store.getProfile(user.userId);
    if (existing) {
      const next = {
        ...existing,
        walletAddress: existing.walletAddress || "0x1111111111111111111111111111111111111111",
        recentRecipients: existing.recentRecipients || existing.recipients || [],
        contacts: existing.contacts || [],
        settings: {
          ...DEFAULT_SETTINGS,
          ...(existing.settings || {})
        }
      };
      await this.store.upsertProfile(next);
      return next;
    }
    const profile = {
      userId: user.userId,
      displayName: user.displayName,
      bankAlias: "Velora Main",
      customerTier: "Private",
      walletAddress: "0x1111111111111111111111111111111111111111",
      recentRecipients: [],
      contacts: [
        {
          contactId: "contact-jiyun",
          name: "Jiyun Park",
          walletAddress: "0x3333333333333333333333333333333333333333",
          memo: "자주 송금",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      settings: { ...DEFAULT_SETTINGS },
      accounts: DEFAULT_PORTFOLIO.map((item) => ({ ...item })),
      transferStats: {
        totalTransfers: 0,
        privateTransfers: 0,
        pendingTransfers: 0
      },
      updatedAt: new Date().toISOString()
    };
    await this.store.upsertProfile(profile);
    return profile;
  }

  async recordTransfer(request) {
    const profile = await this.ensureProfile({
      userId: request.userId,
      displayName: request.senderWalletAddress
    });
    const next = structuredClone(profile);
    const assetCode = inferAssetCode(request);
    const account = next.accounts.find((item) => item.assetCode === assetCode);
    const amount = BigInt(
      request.amountToPrivate || request.amountToPublic || request.amountPrivateIn || request.amountPublicIn || "0"
    );
    const isPrivate = BigInt(request.amountPrivateIn || "0") > 0n || BigInt(request.amountToPrivate || "0") > 0n;

    if (account) {
      const available = BigInt(account.available || "0");
      const privacyReady = BigInt(account.privacyReady || "0");
      account.available = maxBigInt(available - amount, 0n).toString();
      if (isPrivate) {
        account.privacyReady = maxBigInt(privacyReady - amount, 0n).toString();
      }
    }

    const existingRecent = next.recentRecipients.find(
      (item) => item.walletAddress === request.receiverWalletAddress
    );
    if (!existingRecent) {
      next.recentRecipients.unshift({
        name: this.resolveDisplayName(next, request.receiverWalletAddress, request.receiverName),
        walletAddress: request.receiverWalletAddress,
        lastUsedAt: new Date().toISOString()
      });
      next.recentRecipients = next.recentRecipients.slice(0, 6);
    } else {
      existingRecent.lastUsedAt = new Date().toISOString();
      existingRecent.name = this.resolveDisplayName(next, request.receiverWalletAddress, request.receiverName);
    }

    next.transferStats.totalTransfers += 1;
    if (isPrivate) {
      next.transferStats.privateTransfers += 1;
    }
    next.transferStats.pendingTransfers = 0;
    next.updatedAt = new Date().toISOString();
    await this.store.upsertProfile(next);
    return next;
  }

  async getSummary(userId) {
    const profile = await this.store.getProfile(userId);
    if (!profile) {
      return null;
    }
    const contacts = profile.contacts || [];
    const recentRecipients = profile.recentRecipients || profile.recipients || [];
    return {
      bankAlias: profile.bankAlias,
      walletAddress: profile.walletAddress,
      customerTier: profile.customerTier,
      accounts: profile.accounts,
      recipients: recentRecipients,
      contacts,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(profile.settings || {})
      },
      transferStats: profile.transferStats,
      updatedAt: profile.updatedAt
    };
  }

  async addContact(userId, input) {
    return this.store.mutate((data) => {
      const profile = data.profiles[userId];
      if (!profile) {
        throw new Error("profile not found");
      }
      const now = new Date().toISOString();
      const existing = profile.contacts.find((item) => item.walletAddress === input.walletAddress);
      if (existing) {
        existing.name = input.name || existing.name;
        existing.memo = input.memo ?? existing.memo ?? "";
        existing.updatedAt = now;
        return existing;
      }
      const contact = {
        contactId: `contact-${Math.random().toString(36).slice(2, 10)}`,
        name: input.name,
        walletAddress: input.walletAddress,
        memo: input.memo || "",
        createdAt: now,
        updatedAt: now
      };
      profile.contacts.unshift(contact);
      profile.contacts = profile.contacts.slice(0, 20);
      profile.updatedAt = now;
      return contact;
    });
  }

  async getContacts(userId) {
    const profile = await this.store.getProfile(userId);
    return profile?.contacts || [];
  }

  async updateSettings(userId, patch) {
    return this.store.mutate((data) => {
      const profile = data.profiles[userId];
      if (!profile) {
        throw new Error("profile not found");
      }
      profile.settings = {
        ...DEFAULT_SETTINGS,
        ...profile.settings,
        ...patch
      };
      profile.updatedAt = new Date().toISOString();
      return profile.settings;
    });
  }

  async getQrPayload(userId) {
    const profile = await this.store.getProfile(userId);
    if (!profile) {
      return null;
    }
    const params = new URLSearchParams({
      name: profile.displayName,
      address: profile.walletAddress
    });
    return `velora://contact?${params.toString()}`;
  }

  parseQrContact(payload) {
    try {
      const url = new URL(payload);
      if (url.protocol !== "velora:") {
        throw new Error("unsupported qr payload");
      }
      return {
        name: url.searchParams.get("name") || "새 친구",
        walletAddress: url.searchParams.get("address") || "",
        memo: "QR로 추가"
      };
    } catch (error) {
      throw new Error("invalid qr payload");
    }
  }

  resolveDisplayName(profile, walletAddress, fallbackName) {
    const contact = (profile.contacts || []).find((item) => item.walletAddress === walletAddress);
    return contact?.name || fallbackName || "새 수신인";
  }
}

function inferAssetCode(request) {
  if (request.tokenType === "ERC721") {
    return "erc721-pass";
  }
  if (request.tokenType === "ERC1155") {
    return "erc1155-points";
  }
  return "erc20-usdc";
}

function maxBigInt(value, floor) {
  return value < floor ? floor : value;
}
