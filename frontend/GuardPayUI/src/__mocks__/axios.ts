/** Mock for axios — used by Jest UI tests so no real network calls happen */
const mockAxios = {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() =>
    Promise.resolve({
      data: {
        score: 55,
        tier: 'WARNING',
        explanation: [
          { factor: 'Voice anomaly detected', points: 25 },
          { factor: 'New beneficiary', points: 15 },
          { factor: 'Urgent language detected', points: 10 },
        ],
        factors: {},
      },
    })
  ),
  create: jest.fn(() => mockAxios),
  defaults: { headers: { common: {} } },
};

export default mockAxios;
