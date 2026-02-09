import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let message = res.statusText;

    // Try to parse JSON and extract user-friendly message
    if (text) {
      try {
        const json = JSON.parse(text);
        message = json.message || json.error || message;
      } catch {
        // Not JSON, use raw text if it's short enough to be user-friendly
        message = text.length < 200 ? text : message;
      }
    }

    // Create error with clean message (no status code prefix)
    const error = new Error(message);
    (error as any).status = res.status;
    throw error;
  }
}

export async function apiRequest(
  urlOrMethod: string,
  urlOrOptions?: string | RequestInit,
  data?: unknown | undefined,
): Promise<Response> {
  let url: string;
  let options: RequestInit;

  if (typeof urlOrOptions === 'string') {
    const method = urlOrMethod;
    url = urlOrOptions;
    
    if (!method || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      throw new Error(`Invalid HTTP method: ${method}. Expected GET, POST, PUT, PATCH, or DELETE.`);
    }
    
    const isFormData = data instanceof FormData;
    options = {
      method: method.toUpperCase(),
      headers: !isFormData && data ? { "Content-Type": "application/json" } : {},
      body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
      credentials: "include",
    };
  } else {
    url = urlOrMethod;
    
    if (!url.startsWith('/') && !url.startsWith('http')) {
      throw new Error(`Invalid URL: ${url}. URL must start with '/' or 'http'.`);
    }
    
    options = {
      ...urlOrOptions,
      credentials: "include",
    };
  }
  
  const res = await fetch(url, options);

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
