import { AppController } from './app.controller.js';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(() => {
    controller = new AppController();
  });

  it('returns a healthy API status', () => {
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('PayPilot API');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
