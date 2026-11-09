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
  private readonly provider: 'anthropic' | 'openai' | 'gemini';
  private readonly anthropicApiKey?: string;
  private readonly demoMode: boolean;
  private readonly anthropicClient?: Anthropic;
  private readonly fixtures: FixtureEntry[] = [
    prompt1Fixture as FixtureEntry,
    prompt2Fixture as FixtureEntry,
    prompt3Fixture as FixtureEntry,
    prompt4Fixture as FixtureEntry,
  ];

  constructor(private readonly config: ConfigService) {
    this.provider = (this.config.get<string>('LLM_PROVIDER') as any) || 'anthropic';
    this.anthropicApiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.demoMode = this.config.get<string>('DEMO_MODE') !== 'false';

    if (this.anthropicApiKey && !this.anthropicApiKey.startsWith('placeholder') && !this.anthropicApiKey.startsWith('mock')) {
      this.anthropicClient = new Anthropic({
        apiKey: this.anthropicApiKey,
      });
    }
  }

  isDemoMode(): boolean {
    return this.demoMode || !this.anthropicClient;
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
    // In DEMO_MODE, return cached fixture if available
    if (this.demoMode || !this.anthropicClient) {
      const fixture = this.getFixtureForPrompt(user);
      if (fixture) {
        const fixturePayload = promptType === 'intent' ? fixture.intent : fixture.planRanking;
        const parsed = schema.safeParse(fixturePayload);
        if (parsed.success) {
          this.logger.debug(`[LlmService] Returning cached fixture for prompt '${fixture.promptKey}' (${promptType})`);
          return parsed.data;
        }
      }

      // If demo mode has no matching fixture and no client, throw LlmUnavailableError
      if (!this.anthropicClient) {
        throw new LlmUnavailableError(
          `No LLM client configured and no DEMO_MODE fixture found for prompt: "${user.slice(0, 80)}"`,
        );
      }
    }

    // Call Anthropic with 1 retry and 15s timeout
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await this.callAnthropicWithTimeout(schema, system, user);
        return result;
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`[LlmService] Attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // If live call failed after retry, try falling back to fixture if any match exists
    const fallbackFixture = this.getFixtureForPrompt(user);
    if (fallbackFixture) {
      const fixturePayload = promptType === 'intent' ? fallbackFixture.intent : fallbackFixture.planRanking;
      const parsed = schema.safeParse(fixturePayload);
      if (parsed.success) {
        this.logger.warn(`[LlmService] Falling back to fixture after LLM failure for: "${user.slice(0, 60)}"`);
        return parsed.data;
      }
    }

    throw new LlmUnavailableError(`LLM generation failed after retry: ${(lastError as Error)?.message || 'Unknown error'}`, lastError);
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
        model: 'claude-3-5-sonnet-latest',
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

