import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { ZodType } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';
import { LlmUnavailableError } from './llm-errors.js';

export interface FixtureEntry {
  promptKey: string;
  rawInput: string;
  intent: Record<string, unknown>;
  planRanking: Record<string, unknown>;
}

export type LlmProviderName = 'anthropic' | 'gemini' | 'fixture';
export type LlmRuntimeMode = 'live' | 'live+fallback' | 'fixture';

export interface LlmCallMeta {
  provider: LlmProviderName;
  model: string;
  latencyMs: number;
  mode: LlmRuntimeMode;
  fallbackUsed: boolean;
  fallbackReason?: string;
  attempts: number;
}

export interface LlmGenerationResult<T> {
  data: T;
  meta: LlmCallMeta;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
}

const SUPPORTED_PROVIDERS = new Set(['anthropic', 'gemini']);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashPrompt(text: string): string {
  return createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toJsonSchema(schema: ZodType<unknown>): Record<string, unknown> | null {
  const candidate = schema as ZodType<unknown> & {
    toJSONSchema?: () => unknown;
  };
  if (typeof candidate.toJSONSchema !== 'function') return null;
  try {
    const out = candidate.toJSONSchema();
    return isRecord(out) ? out : null;
  } catch {
    return null;
  }
}

function schemaPropertyKeys(schema: ZodType<unknown>): string[] {
  const json = toJsonSchema(schema);
  if (!json || !isRecord(json.properties)) return [];
  return Object.keys(json.properties);
}

function getErrorStatus(err: unknown): number | null {
  if (!isRecord(err)) return null;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  const response = err.response;
  if (isRecord(response) && typeof response.status === 'number') return response.status;
  return null;
}

function isRetryableProviderError(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (status !== null) {
    return status === 429 || status >= 500;
  }
  if (err instanceof LlmUnavailableError) {
    const msg = err.message.toLowerCase();
    if (msg.includes('schema validation failed')) return false;
    if (msg.includes('http 4') && !msg.includes('http 429')) return false;
    return msg.includes('http 429') || msg.includes('http 5') || msg.includes('timeout') || msg.includes('timed out') || msg.includes('fetch failed') || msg.includes('network');
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return msg.includes('timeout') || msg.includes('timed out') || msg.includes('fetch failed') || msg.includes('network');
}

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private anthropicClient: Anthropic | null = null;
  private geminiApiKey: string | null = null;

  private readonly demoMode: boolean;
  private readonly forceLive: boolean;
  private readonly configuredProvider: string;
  private readonly model: string;
  private activeProvider: LlmProviderName = 'fixture';

  private fixtures: FixtureEntry[] = [];
  private fixturesLoaded = false;

  constructor(private readonly config: ConfigService) {
    this.demoMode = this.config.get<string>('DEMO_MODE') === 'true';
    this.forceLive = this.config.get<string>('LLM_FORCE_LIVE') === 'true';
    this.configuredProvider = (this.config.get<string>('LLM_PROVIDER') || 'anthropic').toLowerCase().trim();
    this.model = (this.config.get<string>('LLM_MODEL') || 'claude-sonnet-5-5').trim();
    // Eager load for direct instantiation in tests/scripts
    this.loadFixtures();
  }

  onModuleInit(): void {
    this.loadFixtures();
    this.validateConfig();
    this.initializeProvider();
    this.logger.log(
      `[LlmService] provider=${this.configuredProvider} active=${this.activeProvider} model=${this.model} demo=${this.demoMode} forceLive=${this.forceLive}`,
    );
  }

  private validateConfig(): void {
    if (!SUPPORTED_PROVIDERS.has(this.configuredProvider)) {
      throw new Error(
        `[LlmService] Unsupported LLM_PROVIDER '${this.configuredProvider}'. Expected 'anthropic' or 'gemini'.`,
      );
    }

    const liveRequired = this.forceLive || !this.demoMode;
    if (!liveRequired) return;

    if (!this.model) {
      throw new Error('[LlmService] LLM_MODEL must be set when live LLM mode is required.');
    }

    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');

    if (this.configuredProvider === 'anthropic' && !anthropicKey) {
      throw new Error('[LlmService] ANTHROPIC_API_KEY is required for live LLM mode (LLM_PROVIDER=anthropic).');
    }
    if (this.configuredProvider === 'gemini' && !geminiKey) {
      throw new Error('[LlmService] GEMINI_API_KEY is required for live LLM mode (LLM_PROVIDER=gemini).');
    }
  }

  private initializeProvider(): void {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    const liveRequired = this.forceLive || !this.demoMode;

    if (this.configuredProvider === 'anthropic' && anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      this.activeProvider = 'anthropic';
      return;
    }
    if (this.configuredProvider === 'gemini' && geminiKey) {
      this.geminiApiKey = geminiKey;
      this.activeProvider = 'gemini';
      return;
    }

    if (!liveRequired && this.demoMode) {
      this.activeProvider = 'fixture';
      return;
    }

    this.activeProvider = 'fixture';
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  isForceLive(): boolean {
    return this.forceLive;
  }

  isLiveRequired(): boolean {
    return this.forceLive || !this.demoMode;
  }

  hasLiveProvider(): boolean {
    return Boolean(this.anthropicClient || this.geminiApiKey);
  }

  getProviderName(): LlmProviderName {
    return this.activeProvider;
  }

  getModelName(): string {
    return this.model;
  }

  getModeLabel(): LlmRuntimeMode {
    if (!this.hasLiveProvider()) return 'fixture';
    return 'live';
  }

  getConfigHealth() {
    const liveRequired = this.isLiveRequired();
    const liveAvailable = this.hasLiveProvider();
    const llmMode: LlmRuntimeMode = !liveRequired && !liveAvailable ? 'fixture' : liveAvailable ? 'live' : 'fixture';
    return {
      llmProvider: this.configuredProvider,
      llmModel: this.model,
      llmConfigured: liveAvailable,
      llmMode,
      demoMode: this.demoMode,
      forceLive: this.forceLive,
    };
  }

  private loadFixtures(): void {
    if (this.fixturesLoaded && this.fixtures.length > 0) return;
    try {
      const candidates = [
        path.resolve(process.cwd(), 'fixtures'),
        path.resolve(process.cwd(), 'apps/api/fixtures'),
        path.resolve(process.cwd(), 'src/agent/fixtures'),
        path.resolve(__dirname, '../../fixtures'),
        path.resolve(__dirname, '../../../fixtures'),
        path.resolve(__dirname, '../fixtures'),
      ];
      const fixturesDir = candidates.find((p) => fs.existsSync(p));
      if (!fixturesDir) {
        return;
      }
      const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json') && f.startsWith('prompt-'));
      const loaded: FixtureEntry[] = [];
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(fixturesDir, file), 'utf-8');
          loaded.push(JSON.parse(raw) as FixtureEntry);
        } catch {
          // ignore invalid fixture
        }
      }
      if (loaded.length > 0) {
        this.fixtures = loaded;
        this.fixturesLoaded = true;
      }
    } catch {
      // fixtures are optional in live-only environments
    }
  }

  getFixtureForPrompt(userText: string): FixtureEntry | null {
    this.loadFixtures();
    const norm = userText.toLowerCase();
    if (this.fixtures.length === 0) return null;

    const prompt1Fixture = this.fixtures.find((f) => f.promptKey === 'prompt-1');
    const prompt2Fixture = this.fixtures.find((f) => f.promptKey === 'prompt-2');
    const prompt3Fixture = this.fixtures.find((f) => f.promptKey === 'prompt-3');
    const prompt4Fixture = this.fixtures.find((f) => f.promptKey === 'prompt-4');

    const exactMatch = this.fixtures.find((f) => f.rawInput.toLowerCase().trim() === norm.trim());
    if (exactMatch) return exactMatch;

    const inputHash = hashPrompt(userText);
    const hashMatch = this.fixtures.find((f) => hashPrompt(f.rawInput) === inputHash);
    if (hashMatch) return hashMatch;

    if (
      norm.includes('ignore') ||
      norm.includes('previous instructions') ||
      norm.includes('no approval') ||
      norm.includes('most expensive')
    ) {
      return prompt4Fixture ?? null;
    }
    if (norm.includes('200') && norm.includes('monitor')) {
      return prompt2Fixture ?? null;
    }
    if ((norm.includes('250') || norm.includes('developer')) && norm.includes('monitor')) {
      return prompt1Fixture ?? null;
    }
    if (norm.includes('usb') && (norm.includes('keyboard') || norm.includes('120') || norm.includes('hub'))) {
      return prompt3Fixture ?? null;
    }

    return null;
  }

  private getFixtureResult<T>(schema: ZodType<T>, user: string, promptType: 'intent' | 'planRanking'): T | null {
    const fixture = this.getFixtureForPrompt(user);
    if (!fixture) return null;
    const fixturePayload = promptType === 'intent' ? fixture.intent : fixture.planRanking;
    const parsed = schema.safeParse(fixturePayload);
    return parsed.success ? parsed.data : null;
  }

  async generateJson<T>(
    schema: ZodType<T>,
    system: string,
    user: string,
    promptType: 'intent' | 'planRanking' = 'intent',
  ): Promise<T> {
    const result = await this.generateJsonWithMeta(schema, system, user, promptType);
    return result.data;
  }

  async generateJsonWithMeta<T>(
    schema: ZodType<T>,
    system: string,
    user: string,
    promptType: 'intent' | 'planRanking' = 'intent',
  ): Promise<LlmGenerationResult<T>> {
    const liveRequired = this.isLiveRequired();
    const liveAvailable = this.hasLiveProvider();
    const startedAt = Date.now();

    if (liveRequired && !liveAvailable) {
      throw new LlmUnavailableError('Live LLM mode required but no configured provider API key is available');
    }

    if (!liveRequired && !liveAvailable) {
      const fixtureData = this.getFixtureResult(schema, user, promptType);
      if (!fixtureData) {
        throw new LlmUnavailableError(
          `No LLM client configured and no fixture found for prompt: "${user.slice(0, 80)}"`,
        );
      }
      return {
        data: fixtureData,
        meta: {
          provider: 'fixture',
          model: this.model,
          latencyMs: Date.now() - startedAt,
          mode: 'fixture',
          fallbackUsed: false,
          attempts: 0,
        },
      };
    }

    let lastError: unknown;
    let attempts = 0;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      try {
        const data = this.anthropicClient
          ? await this.callAnthropic(schema, system, user)
          : await this.callGemini(schema, system, user);
        const latencyMs = Date.now() - startedAt;
        return {
          data,
          meta: {
            provider: this.activeProvider === 'fixture' ? 'anthropic' : this.activeProvider,
            model: this.model,
            latencyMs,
            mode: 'live',
            fallbackUsed: false,
            attempts,
          },
        };
      } catch (err) {
        lastError = err;
        const retryable = isRetryableProviderError(err);
        const message = err instanceof Error ? err.message : 'Unknown provider error';
        this.logger.warn(`[LlmService] Attempt ${attempt}/${maxAttempts} failed: ${message}`);
        if (!retryable || attempt === maxAttempts) {
          break;
        }
        const backoffMs = Math.min(250 * 2 ** (attempt - 1), 2000);
        await sleep(backoffMs);
      }
    }

    if (!liveRequired && this.demoMode) {
      const fallbackData = this.getFixtureResult(schema, user, promptType);
      if (fallbackData) {
        const reason = lastError instanceof Error ? lastError.message : 'Unknown LLM failure';
        this.logger.warn(`[LlmService] Falling back to fixture after live LLM failure: ${reason}`);
        return {
          data: fallbackData,
          meta: {
            provider: 'fixture',
            model: this.model,
            latencyMs: Date.now() - startedAt,
            mode: 'live+fallback',
            fallbackUsed: true,
            fallbackReason: reason,
            attempts,
          },
        };
      }
    }

    const finalMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
    throw new LlmUnavailableError(`LLM generation failed after ${attempts} attempt(s): ${finalMessage}`, lastError);
  }

  private async callGemini<T>(schema: ZodType<T>, system: string, user: string): Promise<T> {
    if (!this.geminiApiKey) {
      throw new LlmUnavailableError('Gemini API key not configured');
    }

    const timeoutSignal = AbortSignal.timeout(15000);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;

    const jsonSchema = toJsonSchema(schema);
    const propKeys = schemaPropertyKeys(schema);
    const schemaHint = propKeys.length
      ? `\n\nCRITICAL OUTPUT SPECIFICATION: Return a JSON object with EXACTLY these top-level keys: ${JSON.stringify(propKeys)}.`
      : '';

    const generationConfig: Record<string, unknown> = {
      responseMimeType: 'application/json',
      temperature: 0.1,
    };
    if (jsonSchema) {
      generationConfig.responseSchema = jsonSchema;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.geminiApiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${system}${schemaHint}` }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig,
      }),
      signal: timeoutSignal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const error = new LlmUnavailableError(`Gemini API HTTP ${res.status}: ${errText}`);
      (error as LlmUnavailableError & { status?: number }).status = res.status;
      throw error;
    }

    const resJson = (await res.json()) as GeminiResponse;
    const parts = resJson.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (!text) {
      throw new LlmUnavailableError('Gemini response missing candidate text');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new LlmUnavailableError('Gemini response was not valid JSON');
    }

    const validated = schema.safeParse(parsedJson);
    if (!validated.success) {
      throw new LlmUnavailableError(`Schema validation failed on Gemini output: ${validated.error.message}`);
    }

    return validated.data;
  }

  private async callAnthropic<T>(schema: ZodType<T>, system: string, user: string): Promise<T> {
    if (!this.anthropicClient) {
      throw new LlmUnavailableError('Anthropic client not initialized');
    }

    const timeoutSignal = AbortSignal.timeout(15000);
    const toolName = 'submit_structured_output';
    const jsonSchema = toJsonSchema(schema);
    const payloadSchema = jsonSchema ?? {
      type: 'object',
      description: 'The structured output object',
    };

    const response = await this.anthropicClient.messages.create(
      {
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
        tools: [
          {
            name: toolName,
            description: 'Submit the structured JSON result conforming to the requested schema.',
            input_schema: {
              type: 'object',
              properties: {
                payload: payloadSchema,
              },
              required: ['payload'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: toolName },
      },
      { signal: timeoutSignal },
    );

    const toolUse = response.content.find(
      (block): block is ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) {
      throw new LlmUnavailableError('LLM response did not contain expected structured tool_use block');
    }

    const input = isRecord(toolUse.input) ? toolUse.input : null;
    const rawData = input && 'payload' in input ? input.payload : toolUse.input;
    const validated = schema.safeParse(rawData);
    if (!validated.success) {
      throw new LlmUnavailableError(`Schema validation failed on LLM output: ${validated.error.message}`);
    }

    return validated.data;
  }
}
