import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { LlmService } from './llm.service.js';
import { LlmUnavailableError } from './llm-errors.js';

const schema = z.object({ ok: z.boolean(), value: z.string() });

function liveGeminiConfig(extra: Record<string, string> = {}) {
  return new ConfigService({
    DEMO_MODE: 'false',
    LLM_FORCE_LIVE: 'false',
    LLM_PROVIDER: 'gemini',
    LLM_MODEL: 'gemini-test-model',
    GEMINI_API_KEY: 'test-gemini-key',
    ...extra,
  });
}

describe('LlmService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends Gemini API key in header (not URL) and returns parsed output with meta', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"ok":true,"value":"live"}' }] } }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new LlmService(liveGeminiConfig());
    const result = await service.generateJsonWithMeta(schema, 'system', 'user prompt', 'intent');

    expect(result.data).toEqual({ ok: true, value: 'live' });
    expect(result.meta.provider).toBe('gemini');
    expect(result.meta.mode).toBe('live');
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-test-model:generateContent');
    expect(url).not.toContain('key=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-gemini-key');
  });

  it('does not retry on 4xx errors and throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new LlmService(liveGeminiConfig({ DEMO_MODE: 'true' })); // demo allows fallback attempt path only if fixture found
    await expect(service.generateJsonWithMeta(schema, 'system', 'unmatched prompt 12345', 'intent')).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses deterministic fixtures for supported demo prompts without calling a provider', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network timeout'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new LlmService(liveGeminiConfig({ DEMO_MODE: 'true', LLM_FORCE_LIVE: 'false' }));
    const prompt = 'I need a developer monitor under $250. Prioritize text clarity and value.';
    const result = await service.generateJsonWithMeta(z.any(), 'system', prompt, 'intent');

    expect(result.meta.mode).toBe('fixture');
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.provider).toBe('fixture');
    expect(result.meta.attempts).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on schema validation failure without fallback in live-required mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"ok":"not-bool"}' }] } }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new LlmService(liveGeminiConfig());
    await expect(service.generateJsonWithMeta(schema, 'system', 'user', 'intent')).rejects.toThrow(/Schema validation failed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails boot validation for unsupported provider', () => {
    const service = new LlmService(new ConfigService({ DEMO_MODE: 'true', LLM_PROVIDER: 'unknown' }));
    expect(() => service.onModuleInit()).toThrow(/Unsupported LLM_PROVIDER/);
  });

  it('fails boot validation when live mode requires missing key', () => {
    const service = new LlmService(new ConfigService({
      DEMO_MODE: 'false',
      LLM_PROVIDER: 'gemini',
      LLM_MODEL: 'gemini-test',
      GEMINI_API_KEY: '',
    }));
    expect(() => service.onModuleInit()).toThrow(/GEMINI_API_KEY/);
  });
});
