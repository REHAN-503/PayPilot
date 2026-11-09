import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import type { WebhooksService } from './webhooks.service.js';

describe('WebhooksController /webhooks/paypal', () => {
  let controller: WebhooksController;
  let mockWebhooksService: { handleWebhook: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockWebhooksService = {
      handleWebhook: vi.fn(),
    };
    controller = new WebhooksController(mockWebhooksService as unknown as WebhooksService);
  });

  it('never sets skipVerification and forwards headers and payload to service', async () => {
    const payload = { id: 'WH-123', event_type: 'PAYMENT.CAPTURE.COMPLETED' };
    const mockReq = { rawBody: Buffer.from(JSON.stringify(payload)) } as any;

    mockWebhooksService.handleWebhook.mockResolvedValue({ status: 'PROCESSED' });

    await controller.handlePayPalWebhook(
      'SHA256withRSA',
      'https://cert.paypal.com/test',
      'TRANS-1',
      'MOCK_SIG',
      '2026-11-09T12:00:00Z',
      payload,
      mockReq,
    );

    expect(mockWebhooksService.handleWebhook).toHaveBeenCalledWith(
      {
        authAlgo: 'SHA256withRSA',
        certUrl: 'https://cert.paypal.com/test',
        transmissionId: 'TRANS-1',
        transmissionSig: 'MOCK_SIG',
        transmissionTime: '2026-11-09T12:00:00Z',
      },
      payload,
      expect.objectContaining({
        rawBody: JSON.stringify(payload),
      }),
    );

    // Verify skipVerification is undefined/not true
    const callArgs = mockWebhooksService.handleWebhook.mock.calls[0];
    const options = callArgs[2];
    expect(options?.skipVerification).toBeUndefined();
  });

  it('rejects a forged MOCK_SIG request when service rejects unverified signature', async () => {
    const payload = { id: 'WH-FORGED', event_type: 'PAYMENT.CAPTURE.COMPLETED' };
    const mockReq = { rawBody: Buffer.from(JSON.stringify(payload)) } as any;

    mockWebhooksService.handleWebhook.mockRejectedValue(
      new UnauthorizedException('Invalid PayPal webhook signature'),
    );

    await expect(
      controller.handlePayPalWebhook(
        'SHA256withRSA',
        'https://cert.paypal.com/test',
        'TRANS-FORGED',
        'MOCK_SIG',
        '2026-11-09T12:00:00Z',
        payload,
        mockReq,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an empty request with missing headers when service rejects unverified signature', async () => {
    const payload = {};
    const mockReq = { rawBody: Buffer.from('{}') } as any;

    mockWebhooksService.handleWebhook.mockRejectedValue(
      new UnauthorizedException('Invalid PayPal webhook signature'),
    );

    await expect(
      controller.handlePayPalWebhook(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        payload,
        mockReq,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('never honors skipVerification even if the caller attempts to pass it in payload', async () => {
    const payload = {
      id: 'WH-ATTACK',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      skipVerification: true,
    };
    const mockReq = { rawBody: Buffer.from(JSON.stringify(payload)) } as any;

    mockWebhooksService.handleWebhook.mockResolvedValue({ status: 'PROCESSED' });

    await controller.handlePayPalWebhook(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      payload,
      mockReq,
    );

    const callArgs = mockWebhooksService.handleWebhook.mock.calls[0];
    const options = callArgs[2];
    expect(options?.skipVerification).toBeUndefined();
  });
});

