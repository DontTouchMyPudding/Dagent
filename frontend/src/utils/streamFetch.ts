interface StreamTextOptions<TBody> {
  url: string;
  body: TBody;
  onChunk: (chunk: string) => void;
  onOver?: () => void;
  signal?: AbortSignal;
}

export async function streamText<TBody>(
  options: StreamTextOptions<TBody>,
): Promise<void> {
  const { url, body, onChunk, signal, onOver } = options;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`后端返回 ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("响应体为空，无法读取流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  try {
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    }
    onOver?.();
  } finally {
    reader.releaseLock?.();
  }
}
