/** Mock for audioStream service — used by Jest tests */
export const startAudioStream = jest.fn(() => Promise.resolve());
export const stopAudioStream = jest.fn();
export const isStreamingActive = jest.fn(() => false);
