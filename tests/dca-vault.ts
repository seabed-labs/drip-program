import { testInitVault } from './integration-tests/initVault';
import { testInitVaultProtoConfig } from './integration-tests/initVaultProtoConfig';
import { deposit } from "./integration-tests/deposit";

describe('DCA Vault Program Integration Tests', () => {
  describe('#initVaultProtoConfig', testInitVaultProtoConfig);
  describe('#initVault', testInitVault);
  describe('#deposit', deposit);
});
