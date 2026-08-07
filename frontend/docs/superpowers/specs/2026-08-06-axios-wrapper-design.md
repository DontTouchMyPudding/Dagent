# Axios 封装设计文档

- **日期**: 2026-08-06
- **状态**: 已确认，待实施
- **作者**: Claude Code

## 背景

前端项目已安装 `axios@^1.19.0`，后端 API 统一返回 JSON 结构：

```ts
{
  code: number;
  data: any;
  message: string;
}
```

业务层需要按 `code` 自行判断请求结果。当前项目使用 Vite 代理 `/api` 到 `http://127.0.0.1:8000`，因此前端请求基地址可统一设为 `/api`。

## 目标

- 提供一个统一的 axios 请求入口，避免业务代码直接创建 axios 实例。
- 透传后端返回的完整结构，不隐藏 `code`/`message`。
- 统一处理 baseURL、超时、默认请求头、网络错误格式化。
- 提供类型安全的 `get/post/put/del` 快捷方法。

## 非目标

- 本次封装不包含登录认证（Token、Cookie、签名等）。
- 不替业务层判断 `code` 是否成功，保持透明。
- 不处理 SSE/流式请求，现有 `streamFetch.ts` 继续使用原生 `fetch`。

## 设计详情

### 文件结构

```
src/
  utils/
    request.ts          # axios 实例与导出方法
    request.types.ts    # 类型定义（若类型简单可合并到 request.ts）
```

### 核心类型

```ts
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}
```

### axios 实例配置

```ts
const requestInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### 拦截器

1. **请求拦截器**
   - 若请求未设置 `Content-Type`，自动补 `'application/json'`。
   - 不注入认证信息。

2. **响应错误拦截器**
   - HTTP 状态码非 2xx（如 400/500/网络错误/超时）时，抛出格式化 `Error`。
   - 错误对象包含 `status` 与可读 `message`，方便业务层或全局错误处理。

3. **响应拦截器**
   - 直接透传 `response.data`，不做 `code` 判断。

### 暴露的 API

```ts
// 通用请求
export function request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>>;

// 快捷方法
export function get<T>(url: string, params?: object, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
export function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
export function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
export function del<T>(url: string, params?: object, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
```

### 使用示例

```ts
import { post } from '@/utils/request';

const res = await post<{ id: string }>('/chat/sessions', { title: '新会话' });

if (res.code === 0) {
  console.log(res.data.id);
} else {
  message.error(res.message);
}
```

## 决策与取舍

- **透传 `ApiResponse` 而非自动抛异常**：用户明确表示按 `code` 判断结果，因此保持透明，由业务层决定成功逻辑。
- **不配置路径别名**：当前 `tsconfig.json` 未启用 `@/` 路径别名，因此内部导入使用相对路径 `../utils/types` 或同级相对路径。
- **SSE 保持独立**：流式请求仍由 `streamFetch.ts` 负责，避免 axios 封装引入不必要的复杂性。

## 后续可扩展

- 如需认证，可在请求拦截器注入 Token，并在 401 时统一处理。
- 如需全局 loading，可在拦截器中集成状态管理。
- 如需请求重试，可扩展响应错误拦截器。
