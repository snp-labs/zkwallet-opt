import { randomId } from "../lib/ids.js";
import { signJwt } from "../lib/jwt.js";

export class AuthService {
  constructor({ store, jwtSecret, profileService }) {
    this.store = store;
    this.jwtSecret = jwtSecret;
    this.profileService = profileService;
  }

  async issueMockLogin({ provider, socialId, email, displayName }) {
    const normalizedProvider = provider || "mock";
    const normalizedSocialId = socialId || email || randomId("social");
    const userId = `${normalizedProvider}:${normalizedSocialId}`;
    const user = {
      userId,
      provider: normalizedProvider,
      socialId: normalizedSocialId,
      email: email || null,
      displayName: displayName || email || normalizedSocialId,
      custodyWalletAddress: null,
      createdAt: new Date().toISOString()
    };
    await this.store.upsertUser(user);
    if (this.profileService) {
      await this.profileService.ensureProfile(user);
    }
    const accessToken = signJwt(
      {
        sub: userId,
        role: "user",
        provider: normalizedProvider
      },
      this.jwtSecret,
      3600
    );
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: 3600,
      user
    };
  }
}
