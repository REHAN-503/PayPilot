'use client';

import { useEffect, useRef, useState } from 'react';
import type { TimelineEvent } from '../lib/schemas';

export function useEventStream(onEvent?: (event: TimelineEvent) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<TimelineEvent | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;
      try {
        eventSource = new EventSource('/api/timeline/stream', {
          withCredentials: true,
        });

        eventSource.onopen = () => {
          if (!isCancelled) setIsConnected(true);
        };

        eventSource.addEventListener('timeline_event', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data) as TimelineEvent;
            setLastEvent(data);
            if (onEventRef.current) {
              onEventRef.current(data);
            }
          } catch {
            // Ignore parse errors
          }
        });

        eventSource.onerror = () => {
          if (!isCancelled) setIsConnected(false);
          eventSource?.close();
          // Retry connection after 3s
          setTimeout(() => {
            if (!isCancelled) connect();
          }, 3000);
        };
      } catch {
        if (!isCancelled) setIsConnected(false);
      }
    }

    connect();

    return () => {
      isCancelled = true;
      eventSource?.close();
    };
  }, []);

  return { isConnected, lastEvent };
}

