import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatSession } from "../utils/types";
import { createSession as apiCreateSession, fetchSessions } from "../api/chat";

const SESSIONS_QUERY_KEY = ["chat", "sessions"] as const;

export interface UseSessionsReturn {
  sessions: ChatSession[];
  activeSessionId: string | null;
  selectSession: (id: string | null) => void;
  createSession: () => Promise<string>;
  loading: boolean;
  error: string | null;
}

export interface UseSessionsOptions {
  urlSessionId?: string;
}

export function useSessions({
  urlSessionId,
}: UseSessionsOptions = {}): UseSessionsReturn {
  const queryClient = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    urlSessionId ?? null,
  );

  const {
    data: sessions = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetchSessions();
      return response.data;
    },
    select: (data) => data.list,
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiCreateSession();
      return response.data;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(
        SESSIONS_QUERY_KEY,
        (old: { total: number; list: ChatSession[] } | undefined) => {
          const list = old?.list ?? [];
          return { total: (old?.total ?? 0) + 1, list: [session, ...list] };
        },
      );
      setActiveSessionId(session.id);
    },
  });

  useEffect(() => {
    setActiveSessionId(urlSessionId ?? null);
  }, [urlSessionId]);

  const selectSession = useCallback((id: string | null) => {
    setActiveSessionId(id);
  }, []);

  const createSession = useCallback(async (): Promise<string> => {
    const session = await createSessionMutation.mutateAsync();
    return session.id;
  }, [createSessionMutation]);

  const error = useMemo(() => {
    if (queryError instanceof Error) return queryError.message;
    if (createSessionMutation.error instanceof Error)
      return createSessionMutation.error.message;
    return null;
  }, [queryError, createSessionMutation.error]);

  return {
    sessions,
    activeSessionId,
    selectSession,
    createSession,
    loading,
    error,
  };
}
