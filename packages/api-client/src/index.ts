import type {
  ApiError,
  BulkEnvironmentRequest,
  BulkEnvironmentResponse,
  CreateVaultRequest,
  CreateProjectRequest,
  CreateEnvironmentRequest,
  CreateVariableRequest,
  EnvironmentDto,
  ImportEnvironmentRequest,
  ImportEnvironmentResponse,
  ProjectDto,
  SessionResponse,
  SessionUser,
  UpdateProfileRequest,
  UpdateProjectRequest,
  UpdateEnvironmentRequest,
  UpdateVariableRequest,
  VariableDto,
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

  public readonly projects = {
    list: () => this.request<{ projects: ProjectDto[] }>("/api/v1/projects"),
    create: (input: CreateProjectRequest) =>
      this.request<ProjectDto>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (projectId: string, input: UpdateProjectRequest) =>
      this.request<ProjectDto>(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (projectId: string) =>
      this.request<{ deleted: true }>(`/api/v1/projects/${projectId}`, {
        method: "DELETE",
      }),
  };

  public readonly profile = {
    get: () => this.request<SessionUser>("/api/v1/profile"),
    update: (input: UpdateProfileRequest) =>
      this.request<SessionUser>("/api/v1/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  };

  public readonly environments = {
    list: (projectId: string) =>
      this.request<{ environments: EnvironmentDto[] }>(
        `/api/v1/projects/${projectId}/environments`,
      ),
    update: (environmentId: string, input: UpdateEnvironmentRequest) =>
      this.request<EnvironmentDto>(`/api/v1/environments/${environmentId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (environmentId: string, expectedVersion: number) =>
      this.request<{ deleted: true }>(`/api/v1/environments/${environmentId}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion }),
      }),
    create: (projectId: string, input: CreateEnvironmentRequest) =>
      this.request<EnvironmentDto>(
        `/api/v1/projects/${projectId}/environments`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
  };

  public readonly variables = {
    list: (environmentId: string) =>
      this.request<{ variables: VariableDto[]; version: number }>(
        `/api/v1/environments/${environmentId}/variables`,
      ),
    create: (environmentId: string, input: CreateVariableRequest) =>
      this.request<{ variable: VariableDto; version: number }>(
        `/api/v1/environments/${environmentId}/variables`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    update: (variableId: string, input: UpdateVariableRequest) =>
      this.request<{ variable: VariableDto; version: number }>(
        `/api/v1/variables/${variableId}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    delete: (variableId: string, expectedVersion: number) =>
      this.request<{ deleted: true; version: number }>(
        `/api/v1/variables/${variableId}`,
        { method: "DELETE", body: JSON.stringify({ expectedVersion }) },
      ),
  };

  public readonly imports = {
    commit: (environmentId: string, input: ImportEnvironmentRequest) =>
      this.request<ImportEnvironmentResponse>(
        `/api/v1/environments/${environmentId}/import`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };

  public readonly bulk = {
    commit: (environmentId: string, input: BulkEnvironmentRequest) =>
      this.request<BulkEnvironmentResponse>(
        `/api/v1/environments/${environmentId}/bulk`,
        { method: "POST", body: JSON.stringify(input) },
      ),
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
