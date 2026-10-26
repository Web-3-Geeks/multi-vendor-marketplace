const mockProvider = require("./mockProvider");

const providers = { mock: mockProvider };

const getProvider = () => {
  const provider = providers[process.env.PAYMENT_PROVIDER];
  if (!provider) {
    throw new Error(`Unknown PAYMENT_PROVIDER: ${process.env.PAYMENT_PROVIDER}`);
  }
  return provider;
};

module.exports = { getProvider };
