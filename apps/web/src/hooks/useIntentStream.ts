'use client';

import * as React from 'react';

export interface AgentActivity {
  type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface IntentStreamResult {
  intent?: unknown;
  plan?: { id: string };
  policyEvaluation?: { decision: string; violations?: string[] };
  riskAssessment?: { level?: string; score?: number };
}

interface UseIntentStreamOptions {
  onActivity: (activity: AgentActivity) => void;
  onResult: (result: IntentStreamResult) => void;
  onError: (error: Error) => void;
}

export function useIntentStream() {
  const [isStreaming, setIsStreaming] = React.useState(false);

  const stream = React.useCallback(
    async (
      rawInput: string,
      options: UseIntentStreamOptions,
    ): Promise<void> => {
      setIsStreaming(true);
      const response = await fetch('/api/intents/stream', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      });

      if (!response.ok || !response.body) {
        setIsStreaming(false);
        throw new Error(`Intent stream failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const event of events) {
            const typeLine = event.split('\n').find((line) => line.startsWith('event:'));
            const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
            if (!typeLine || !dataLine) continue;

            const type = typeLine.slice('event:'.length).trim();
            const data = JSON.parse(dataLine.slice('data:'.length).trim()) as unknown;
            if (type === 'activity') {
              options.onActivity(data as AgentActivity);
            } else if (type === 'result') {
              options.onResult(data as IntentStreamResult);
            } else if (type === 'error') {
              const message =
                typeof data === 'object' && data !== null && 'message' in data
                  ? String(data.message)
                  : 'Intent stream failed';
              throw new Error(message);
            }
          }

          if (done) break;
        }
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error('Intent stream failed');
        options.onError(normalized);
        throw normalized;
      } finally {
        reader.releaseLock();
        setIsStreaming(false);
      }
    },
    [],
  );

  return { stream, isStreaming };
}
