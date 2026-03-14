import { envConfig } from '../config/env';
import { getToken } from './storage';
import type { SSEEvent } from '../types';

interface SSEOptions {
  url: string;
  body?: Record<string, unknown>;
  onMessage: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

interface SSEConnection {
  abort: () => void;
}

function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = chunk.split('\n\n').filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n');
    const event: Partial<SSEEvent> = {};

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event.event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        event.data = (event.data ?? '') + line.slice(5).trim();
      } else if (line.startsWith('id:')) {
        event.id = line.slice(3).trim();
      } else if (line.startsWith('retry:')) {
        event.retry = parseInt(line.slice(6).trim(), 10);
      }
    }

    if (event.data !== undefined) {
      events.push(event as SSEEvent);
    }
  }

  return events;
}

/**
 * H5 uses native EventSource / fetch with ReadableStream.
 * Mini-program uses uni.request with enableChunked for streaming.
 */
export function createSSEConnection(options: SSEOptions): SSEConnection {
  const { url, body, onMessage, onError, onComplete } = options;
  const fullUrl = url.startsWith('http') ? url : `${envConfig.apiBaseUrl}${url}`;
  const token = getToken();
  let aborted = false;

  // #ifdef H5
  const abortController = new AbortController();

  (async () => {
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

      const decoder = new TextDecoder();
      let buffer = '';

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lastDoubleNewline = buffer.lastIndexOf('\n\n');
        if (lastDoubleNewline === -1) continue;

        const complete = buffer.slice(0, lastDoubleNewline + 2);
        buffer = buffer.slice(lastDoubleNewline + 2);

        const events = parseSSEChunk(complete);
        for (const event of events) {
          if (aborted) break;
          onMessage(event);
        }
      }

      if (buffer.trim()) {
        const events = parseSSEChunk(buffer);
        for (const event of events) {
          onMessage(event);
        }
      }

      onComplete?.();
    } catch (err) {
      if (!aborted) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  })();

  return {
    abort() {
      aborted = true;
      abortController.abort();
    },
  };
  // #endif

  // #ifdef MP-WEIXIN
  const requestTask = uni.request({
    url: fullUrl,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    data: body,
    enableChunked: true,
    responseType: 'text',
    success: () => {
      if (!aborted) onComplete?.();
    },
    fail: (err: UniApp.GeneralCallbackResult) => {
      if (!aborted) onError?.(new Error(err.errMsg));
    },
  });

  let mpBuffer = '';

  requestTask.onChunkReceived?.((res: { data: ArrayBuffer }) => {
    if (aborted) return;
    const text = new TextDecoder().decode(res.data);
    mpBuffer += text;

    const lastDoubleNewline = mpBuffer.lastIndexOf('\n\n');
    if (lastDoubleNewline === -1) return;

    const complete = mpBuffer.slice(0, lastDoubleNewline + 2);
    mpBuffer = mpBuffer.slice(lastDoubleNewline + 2);

    const events = parseSSEChunk(complete);
    for (const event of events) {
      if (aborted) break;
      onMessage(event);
    }
  });

  return {
    abort() {
      aborted = true;
      requestTask.abort();
    },
  };
  // #endif
}
