export interface DlxApiCallParams {
  method: string;
  path: string;
  params?: Record<string, unknown>;
  data?: unknown;
}

interface FetchError extends Error {
  status?: number;
  responseData?: unknown;
  isNetworkError?: boolean;
}

export class DlxService {
  private readonly baseUrl: string;

  constructor() {
    if (!process.env.DLX_API_URL) {
      throw new Error("DLX_API_URL is not set");
    }
    this.baseUrl = process.env.DLX_API_URL;
  }

  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  async executeDlxApiCall({
    method,
    path,
    params,
    data,
  }: DlxApiCallParams): Promise<unknown> {
    try {
      const url = this.buildUrl(path, params);
      
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };
      
      if (data !== undefined) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(url, options);
      
      // Check if the response is ok (status in the range 200-299)
      if (!response.ok) {
        const responseData = await response.json().catch(() => null);
        const error = new Error(`DLX API Error (${response.status})`) as FetchError;
        error.status = response.status;
        error.responseData = responseData;
        throw error;
      }
      
      // For empty responses or 204 No Content
      if (response.status === 204 || response.headers.get("content-length") === "0") {
        return null;
      }
      
      // Parse JSON response
      return await response.json();
    } catch (error: unknown) {
      // Error handling
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network errors
        throw new Error(
          "DLX API Request Error: No response received from server",
        );
      } else if (error instanceof Error && (error as FetchError).status) {
        // Response errors
        const fetchError = error as FetchError;
        throw new Error(
          `DLX API Error (${fetchError.status}): ${JSON.stringify(
            fetchError.responseData,
          )}`,
        );
      } else {
        // Other errors
        throw new Error(
          `DLX API Request Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }
  }
}
