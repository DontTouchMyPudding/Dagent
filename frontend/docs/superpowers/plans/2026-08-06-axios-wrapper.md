# Axios 封装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 frontend 项目中封装 axios，统一 baseURL、超时、默认请求头与错误提示，透传后端 `{ code, data, message }` 结构，并提供类型安全的 `get/post/put/del` 快捷方法。

**Architecture：** 在 `src/utils/request.ts` 中创建单一 axios 实例并导出方法；请求拦截器补全默认 `Content-Type`，响应错误拦截器将网络/HTTP 错误格式化为可读消息；所有方法返回 `Promise<ApiResponse<T>>`，由业务层按 `code` 判断结果。

**Tech Stack：** React 19, TypeScript 6, Vite 8, Vitest 4, axios 1.19

## Global Constraints

- 无登录认证相关逻辑。
- `baseURL` 固定为 `/api`（Vite 代理到 `http://127.0.0.1:8000`）。
- 默认超时 `10000ms`。
- 默认请求头 `Content-Type: application/json`。
- 不处理 SSE/流式请求（继续使用 `streamFetch.ts`）。
- 方法返回透传的 `ApiResponse<T>`，不自动按 `code` 抛异常。

---

## File Structure

- **Create:** `src/utils/request.ts`
  - `ApiResponse<T>` 类型
  - axios 实例配置
  - 请求/响应拦截器
  - 导出的 `request/get/post/put/del` 方法
- **Create:** `src/utils/request.test.ts`
  - 使用 Vitest + `vi.mock('axios')` 测试成功返回、HTTP 错误、网络错误、请求拦截器补全 Content-Type。

---

### Task 1: Implement axios request wrapper with tests

**Files:**
- Create: `src/utils/request.ts`
- Create: `src/utils/request.test.ts`
- Test: `pnpm test src/utils/request.test.ts`

**Interfaces:**
- Consumes: `axios` npm package
- Produces:
  - `ApiResponse<T>` interface
  - `request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>>`
  - `get<T>(url, params?, config?): Promise<ApiResponse<T>>`
  - `post<T>(url, data?, config?): Promise<ApiResponse<T>>`
  - `put<T>(url, data?, config?): Promise<ApiResponse<T>>`
  - `del<T>(url, params?, config?): Promise<ApiResponse<T>>`

- [ ] **Step 1: Write the failing test**

  Create `src/utils/request.test.ts`:

  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    requestUse: vi.fn(),
    responseUse: vi.fn(),
  }));

  vi.mock('axios', () => ({
    default: {
      create: vi.fn(() => ({
        request: mocks.request,
        interceptors: {
          request: { use: mocks.requestUse },
          response: { use: mocks.responseUse },
        },
      })),
    },
  }));

  import { request, get, post, put, del } from './request';

  describe('request utils', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns backend response from request()', async () => {
      mocks.request.mockResolvedValueOnce({
        data: { code: 0, data: { id: '1' }, message: 'ok' },
      });
      const res = await request<{ id: string }>({ url: '/test', method: 'GET' });
      expect(res.code).toBe(0);
      expect(res.data.id).toBe('1');
      expect(res.message).toBe('ok');
    });

    it('get() passes method, url and params', async () => {
      mocks.request.mockResolvedValueOnce({
        data: { code: 0, data: null, message: 'ok' },
      });
      await get('/test', { page: 1 });
      expect(mocks.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          params: { page: 1 },
        }),
      );
    });

    it('post() passes method, url and data', async () => {
      mocks.request.mockResolvedValueOnce({
        data: { code: 0, data: null, message: 'ok' },
      });
      await post('/test', { title: 'hello' });
      expect(mocks.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/test',
          data: { title: 'hello' },
        }),
      );
    });

    it('put() passes method PUT', async () => {
      mocks.request.mockResolvedValueOnce({
        data: { code: 0, data: null, message: 'ok' },
      });
      await put('/test/1', { title: 'updated' });
      expect(mocks.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PUT', url: '/test/1' }),
      );
    });

    it('del() passes method DELETE and params', async () => {
      mocks.request.mockResolvedValueOnce({
        data: { code: 0, data: null, message: 'ok' },
      });
      await del('/test/1', { force: true });
      expect(mocks.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: '/test/1',
          params: { force: true },
        }),
      );
    });

    it('throws formatted HTTP error when response exists', async () => {
      mocks.request.mockRejectedValueOnce({
        response: { status: 500, statusText: 'Internal Server Error' },
      });
      await expect(get('/test')).rejects.toThrow(
        '请求错误 500: Internal Server Error',
      );
    });

    it('throws network error when request was made but no response', async () => {
      mocks.request.mockRejectedValueOnce({ request: {} });
      await expect(get('/test')).rejects.toThrow('网络错误');
    });

    it('request interceptor adds Content-Type when missing', () => {
      let requestInterceptor: ((config: any) => any) | undefined;
      mocks.requestUse.mockImplementation((callback) => {
        requestInterceptor = callback;
      });
      // Re-import to trigger interceptor registration
      vi.resetModules();
      // Interceptor captured above during module init
      expect(requestInterceptor).toBeDefined();
      const config = { headers: {} };
      const result = requestInterceptor!(config);
      expect(result.headers['Content-Type']).toBe('application/json');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `pnpm test src/utils/request.test.ts`

  Expected: FAIL with errors like `Cannot find module './request'` or `request is not exported`.

- [ ] **Step 3: Write minimal implementation**

  Create `src/utils/request.ts`:

  ```ts
  import axios, { AxiosRequestConfig } from 'axios';

  export interface ApiResponse<T = unknown> {
    code: number;
    data: T;
    message: string;
  }

  const requestInstance = axios.create({
    baseURL: '/api',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  requestInstance.interceptors.request.use((config) => {
    const contentType = config.headers?.['Content-Type']
      ?? config.headers?.get?.('Content-Type');
    if (!contentType) {
      config.headers = config.headers ?? {};
      config.headers['Content-Type'] = 'application/json';
    }
    return config;
  });

  requestInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      let message = '请求失败';
      if (error.response) {
        message = `请求错误 ${error.response.status}: ${error.response.statusText}`;
      } else if (error.request) {
        message = '网络错误，请检查网络连接';
      } else if (error.message) {
        message = error.message;
      }
      return Promise.reject(new Error(message));
    },
  );

  export async function request<T>(
    config: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await requestInstance.request<ApiResponse<T>>(config);
    return response.data;
  }

  export async function get<T>(
    url: string,
    params?: object,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return request<T>({ ...config, method: 'GET', url, params });
  }

  export async function post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return request<T>({ ...config, method: 'POST', url, data });
  }

  export async function put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return request<T>({ ...config, method: 'PUT', url, data });
  }

  export async function del<T>(
    url: string,
    params?: object,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return request<T>({ ...config, method: 'DELETE', url, params });
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  Run: `pnpm test src/utils/request.test.ts`

  Expected: All tests PASS.

- [ ] **Step 5: Type-check the project**

  Run: `pnpm run build` or `pnpm exec tsc --noEmit`

  Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/utils/request.ts src/utils/request.test.ts
  git commit -m "feat(utils): add axios request wrapper without auth

  - Add ApiResponse<T> type matching backend format
  - Configure axios instance with baseURL /api and 10s timeout
  - Add default Content-Type request interceptor
  - Add formatted error messages for HTTP/network errors
  - Export request/get/post/put/del helpers
  - Add unit tests with mocked axios"
  ```

---

## Self-Review

1. **Spec coverage:**
   - 文件位置 `src/utils/request.ts` → Task 1 Step 3。
   - `ApiResponse<T>` 类型 → Task 1 Step 3。
   - axios 实例 baseURL `/api`、timeout `10000`、默认 Content-Type → Task 1 Step 3。
   - 请求拦截器补全 Content-Type → Task 1 Step 3 + 测试 Step 1 最后一条用例。
   - 响应错误格式化 → Task 1 Step 3 + 测试 Step 1 HTTP/网络错误用例。
   - 暴露 `request/get/post/put/del` → Task 1 Step 3 + 测试 Step 1 各方法用例。
   - 无登录认证 → Task 1 Step 3 未注入 Token/Cookie。

2. **Placeholder scan:** 无 TBD/TODO/模糊描述；所有代码块包含完整代码。

3. **Type consistency:** `ApiResponse<T>`、`AxiosRequestConfig`、方法签名在实现与测试中一致。

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-06-axios-wrapper.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
