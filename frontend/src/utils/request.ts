import axios, { AxiosRequestConfig } from "axios";

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

const requestInstance = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

requestInstance.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  const headers = config.headers as Record<string, string>;
  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return config;
});

requestInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = "请求失败";
    if (error.response) {
      message = `请求错误 ${error.response.status}: ${error.response.statusText}`;
    } else if (error.request) {
      message = "网络错误，请检查网络连接";
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
  return request<T>({ ...config, method: "GET", url, params });
}

export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return request<T>({ ...config, method: "POST", url, data });
}

export async function put<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return request<T>({ ...config, method: "PUT", url, data });
}

export async function del<T>(
  url: string,
  params?: object,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return request<T>({ ...config, method: "DELETE", url, params });
}
