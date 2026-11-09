import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { type ZodType } from 'zod';
import { createHash } from 'node:crypto';
import { LlmUnavailableError } from './llm-errors.js';

// Import fixtures directly for zero-IO bundle reliability
import prompt1Fixture from '../fixtures/prompt-1-developer-monitor.json' with { type: 'json' };
import prompt2Fixture from '../fixtures/prompt-2-monitor-under-200.json' with { type: 'json' };
import prompt3Fixture from '../fixtures/prompt-3-usbc-keyboard.json' with { type: 'json' };
import prompt4Fixture from '../fixtures/prompt-4-prompt-injection.json' with { type: 'json' };

export interface FixtureEntry {
  promptKey: string;
  rawInput: string;
  normalized: string;
  intent: unknown;
  planRanking: unknown;
}

export function normalizePrompt(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashPrompt(text: string): string {
  return createHash('sha256').update(normalizePrompt(text)).digest('hex').slice(0, 16);
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: 'anthropic' | 'gemini' | 'openai';
  private readonly anthropicApiKey?: string;
  private readonly geminiApiKey?: string;
  private readonly model: string;
  private readonly demoMode: boolean;
  private readonly forceLive: boolean;
  private readonly anthropicClient?: Anthropic;
  private readonly fixtures: FixtureEntry[] = [
    prompt1Fixture as FixtureEntry,
    prompt2Fixture as FixtureEntry,
    prompt3Fixture as FixtureEntry,
    prompt4Fixture as FixtureEntry,
  ];

  constructor(private readonly config: ConfigService) {
    const configuredProvider = this.config.get<string>('LLM_PROVIDER');
    this.provider =
      configuredProvider === 'gemini' || configuredProvider === 'openai'
        ? configuredProvider
        : 'anthropic';
    this.anthropicApiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.geminiApiKey = this.config.get<string>('GEMINI_API_KEY');
    this.demoMode = this.config.get<string>('DEMO_MODE') === 'true';
    this.forceLive = this.config.get<string>('LLM_FORCE_LIVE') === 'true';

    this.model = this.config.get<string>('LLM_MODEL') || 'claude-sonnet-5-5';

    if (
      this.anthropicApiKey &&
      !this.anthropicApiKey.startsWith('placeholder') &&
      !this.anthropicApiKey.startsWith('mock')
    ) {
      this.anthropicClient = new Anthropic({
        apiKey: this.anthropicApiKey,
      });
    }

    this.logger.log(
      `[LlmService] provider=${this.provider} model=${this.model} mode=${this.isFixtureMode() ? 'fixture' : 'live'}`,
    );

    if (!this.isFixtureMode() && !this.anthropicClient && !this.geminiApiKey) {
      this.logger.error(
        '[LlmService] Live LLM mode requires a configured provider API key.',
      );
    }
  }

  isFixtureMode(): boolean {
    return this.demoMode && !this.forceLive;
  }

  isForceLive(): boolean {
    return this.forceLive;
  }

  isDemoMode(): boolean {
    return this.isFixtureMode();
  }

  getFixtureForPrompt(userText: string): FixtureEntry | null {
    const norm = normalizePrompt(userText);

    // 1. Direct normalized match
    const exact = this.fixtures.find((f) => f.normalized === norm);
    if (exact) return exact;

    // 2. Hash match
    const inputHash = hashPrompt(userText);
    const hashMatch = this.fixtures.find((f) => hashPrompt(f.rawInput) === inputHash);
    if (hashMatch) return hashMatch;

    // 3. Keyword / semantic fallback match for the 4 demo prompts
    if (norm.includes('ignore') || norm.includes('previous instructions') || norm.includes('no approval') || norm.includes('most expensive')) {
      return prompt4Fixture as FixtureEntry;
    }
    if (norm.includes('200') && norm.includes('monitor')) {
      return prompt2Fixture as FixtureEntry;
    }
    if ((norm.includes('250') || norm.includes('developer')) && norm.includes('monitor')) {
      return prompt1Fixture as FixtureEntry;
    }
    if (norm.includes('usb') && (norm.includes('keyboard') || norm.includes('120') || norm.includes('hub'))) {
      return prompt3Fixture as FixtureEntry;
    }

    return null;
  }

  async generateJson<T>(
    schema: ZodType<T>,
    system: string,
    user: string,
    promptType: 'intent' | 'planRanking' = 'intent',
  ): Promise<T> {
    const hasLiveLlm = Boolean(this.anthropicClient || this.geminiApiKey);

    if (!this.isFixtureMode() && !hasLiveLlm) {
      this.logger.error(
        `[LlmService] Live LLM mode has no provider API key for prompt: "${user.slice(0, 80)}"`,
      );
      throw new LlmUnavailableError(
        'DEMO_MODE is false but no LLM API key (ANTHROPIC_API_KEY / GEMINI_API_KEY) is configured',
      );
    }

    // When a live LLM key is configured, ALWAYS invoke the real LLM provider first.
    // Cached demo fixtures are ONLY used when no live LLM client exists, or as an emergency fallback.
    if (!hasLiveLlm && this.isFixtureMode()) {
      const fixture = this.getFixtureForPrompt(user);
      if (fixture) {
        const fixturePayload = promptType === 'intent' ? fixture.intent : fixture.planRanking;
        const parsed = schema.safeParse(fixturePayload);
        if (parsed.success) {
          this.logger.debug(`[LlmService] Returning cached fixture for prompt '${fixture.promptKey}' (${promptType})`);
          return parsed.data;
        }
      }

      throw new LlmUnavailableError(
        `No LLM client configured and no DEMO_MODE fixture found for prompt: "${user.slice(0, 80)}"`,
      );
    }

    // Call live LLM provider with 1 retry and 15s timeout
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (this.anthropicClient) {
          return await this.callAnthropicWithTimeout(schema, system, user);
        } else if (this.geminiApiKey) {
          return await this.callGeminiWithTimeout(schema, system, user);
        }
      } catch (err: unknown) {
        lastError = err;
        const message = err instanceof Error ? err.message : 'Unknown provider error';
        this.logger.warn(`[LlmService] Attempt ${attempt + 1} failed: ${message}`);
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // Fixture mode may recover from a transient provider failure with a known fixture.
    if (this.isFixtureMode()) {
      const fallbackFixture = this.getFixtureForPrompt(user);
      if (fallbackFixture) {
        const fixturePayload = promptType === 'intent' ? fallbackFixture.intent : fallbackFixture.planRanking;
        const parsed = schema.safeParse(fixturePayload);
        if (parsed.success) {
          this.logger.warn(`[LlmService] Falling back to fixture after LLM failure for: "${user.slice(0, 60)}"`);
          return parsed.data;
        }
      }
    }

    throw new LlmUnavailableError(`LLM generation failed after retry: ${(lastError as Error)?.message || 'Unknown error'}`, lastError);
  }

  private async callGeminiWithTimeout<T>(
    schema: ZodType<T>,
    system: string,
    user: string,
  ): Promise<T> {
    const timeoutSignal = AbortSignal.timeout(15000);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${this.geminiApiKey}`;

    // Helper to format schema instruction so Gemini reliably adheres to expected JSON keys
    let schemaHint = '';
    try {
      const jsonSchema = (schema as any).toJSONSchema ? (schema as any).toJSONSchema() : null;
      if (jsonSchema && jsonSchema.properties) {
        const propKeys = Object.keys(jsonSchema.properties);
        schemaHint = `\n\nCRITICAL OUTPUT SPECIFICATION: Return a JSON object with EXACTLY these top-level keys: ${JSON.stringify(propKeys)}. Schema details:\n${JSON.stringify(jsonSchema.properties, null, 2)}`;
      }
    } catch {
      // Fallback if toJSONSchema is unavailable
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system + schemaHint }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
      signal: timeoutSignal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new LlmUnavailableError(`Gemini API HTTP ${res.status}: ${errText}`);
    }

    const resJson = (await res.json()) as any;
    const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new LlmUnavailableError('Gemini response missing candidate text');
    }

    const parsedJson = JSON.parse(text);
    const validated = schema.safeParse(parsedJson);
    if (!validated.success) {
      throw new LlmUnavailableError(`Schema validation failed on Gemini output: ${validated.error.message}`);
    }

    return validated.data;
  }

  private async callAnthropicWithTimeout<T>(
    schema: ZodType<T>,
    system: string,
    user: string,
  ): Promise<T> {
    if (!this.anthropicClient) {
      throw new LlmUnavailableError('Anthropic client not initialized');
    }

    // 15-second timeout signal
    const timeoutSignal = AbortSignal.timeout(15000);

    const toolName = 'submit_structured_output';
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
              // Dynamic schema passed to tool
              properties: {
                payload: {
                  type: 'object',
                  description: 'The structured output object',
                },
              },
              required: ['payload'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: toolName },
      },
      { signal: timeoutSignal },
    );

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new LlmUnavailableError('LLM response did not contain expected structured tool_use block');
    }

    const rawData = (toolUse.input as any)?.payload ?? toolUse.input;
    const validated = schema.safeParse(rawData);
    if (!validated.success) {
      throw new LlmUnavailableError(`Schema validation failed on LLM output: ${validated.error.message}`);
    }

    return validated.data;
  }
}
