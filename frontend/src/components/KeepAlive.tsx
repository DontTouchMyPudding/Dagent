import { ReactNode, useRef } from "react";

interface KeepAliveProps {
  activeKey: string | null;
  max?: number;
  children: (key: string) => ReactNode;
}

interface CacheItem {
  key: string;
  element: ReactNode;
  lastAccessed: number;
}

export default function KeepAlive({
  activeKey,
  max = 10,
  children,
}: KeepAliveProps) {
  const cacheRef = useRef(new Map<string, CacheItem>());

  if (activeKey) {
    const cache = cacheRef.current;
    const now = Date.now();

    if (!cache.has(activeKey)) {
      cache.set(activeKey, {
        key: activeKey,
        element: children(activeKey),
        lastAccessed: now,
      });
    } else {
      cache.get(activeKey)!.lastAccessed = now;
    }

    if (cache.size > max) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, item] of cache) {
        if (key === activeKey) continue;
        if (item.lastAccessed < oldestTime) {
          oldestTime = item.lastAccessed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
  }

  return (
    <>
      {Array.from(cacheRef.current.entries()).map(([key, item]) => (
        <div
          key={key}
          style={{
            display: key === activeKey ? "flex" : "none",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            overflow: key === activeKey ? undefined : "hidden",
          }}
        >
          {item.element}
        </div>
      ))}
    </>
  );
}
