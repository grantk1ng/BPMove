let running = false;

export default {
  start: jest.fn(async () => { running = true; }),
  stop: jest.fn(async () => { running = false; }),
  isRunning: jest.fn(() => running),
  updateNotification: jest.fn(async () => {}),
  on: jest.fn(),
};
