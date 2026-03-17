import http from "node:http";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { JobStore } from "./store/jobStore.js";
import { AuthService } from "./services/authService.js";
import { CustodyOrchestrator } from "./services/custodyOrchestrator.js";
import { LocalChainService } from "./services/localChainService.js";
import { ProfileService } from "./services/profileService.js";
import { ZkPasskeyService } from "./services/zkpasskeyService.js";

const config = loadConfig();
const store = new JobStore(config.dataFile);
await store.init();

const profileService = new ProfileService({
  store
});

const authService = new AuthService({
  store,
  jwtSecret: config.jwtSecret,
  profileService
});

const localChainService = new LocalChainService({
  store,
  profileService
});

const zkpasskeyService = new ZkPasskeyService({
  config,
  store,
});

const orchestrator = new CustodyOrchestrator({
  config,
  store,
  localChainService
});

const app = createApp({
  config,
  store,
  authService,
  orchestrator,
  profileService,
  zkpasskeyService
});

const server = http.createServer(app);

server.listen(config.port, config.host, () => {
  console.log(
    `[${config.appName}] listening on http://${config.host}:${config.port}`
  );
});
