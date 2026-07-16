import type {
  ApiError,
  CreateVaultRequest,
  SessionResponse,
  VaultDto,
  VaultSettings,
  VaultStatus,
} from "@envault/api-contract";

export interface EnvaultClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
}

interface SuccessEnvelope<T> {
  data: T;
  meta: { requestId: string };
}

interface ErrorEnvelope {
  error: ApiError;
  meta: { requestId: string };
}

export class EnvaultApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly error: ApiError,
    public readonly requestId: string,
  ) {
    super(error.message);
    this.name = "EnvaultApiError";
  }
}

export class EnvaultClient {
  readonly #baseUrl: string;
  readonly #getAccessToken?: () => Promise<string | null>;
  readonly #fetch: typeof globalThis.fetch;

  public constructor(options: EnvaultClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#getAccessToken = options.getAccessToken;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  public readonly auth = {
    session: {
      get: () => this.request<SessionResponse>("/api/v1/auth/session"),
      create: (idToken: string) =>
        this.request<SessionResponse>("/api/v1/auth/session", {
          method: "POST",
          body: JSON.stringify({ idToken }),
        }),
      delete: () =>
        this.request<{ signedOut: true }>("/api/v1/auth/session", {
          method: "DELETE",
        }),
    },
  };

  public readonly vault = {
    get: () => this.request<VaultStatus>("/api/v1/vault"),
    getSettings: () => this.request<VaultSettings>("/api/v1/vault/settings"),
    create: (input: CreateVaultRequest) =>
      this.request<VaultDto>("/api/v1/vault", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };

  public async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    if (init.body) {
      headers.set("Content-Type", "application/json");
    }

    const accessToken = await this.#getAccessToken?.();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
    const body = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope;

    if (!response.ok || "error" in body) {
      const errorBody = body as ErrorEnvelope;
      throw new EnvaultApiError(
        response.status,
        errorBody.error,
        errorBody.meta.requestId,
      );
    }

    return body.data;
  }
}
