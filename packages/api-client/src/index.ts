import type {
  ApiError,
  BulkEnvironmentRequest,
  BulkEnvironmentResponse,
  ClipboardItemContentDto,
  ClipboardItemDto,
  ClipboardList,
  CreateClipboardItemRequest,
  CreateVaultRequest,
  CreateProjectRequest,
  CreateEnvironmentRequest,
  CreateVariableRequest,
  CreateDeviceAuthorizationRequest,
  DeviceAuthorizationResponse,
  DeviceSession,
  DeviceVaultKeyStatus,
  DeviceWrappedVaultKey,
  EnvironmentDto,
  ImportEnvironmentRequest,
  ImportEnvironmentResponse,
  ImportPasswordsRequest,
  ImportPasswordsResponse,
  CreatePasswordItemRequest,
  UpdatePasswordItemRequest,
  PasswordItemDto,
  PasswordList,
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
} from "@keephq/api-contract";

export interface KeepClientOptions {
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

export class KeepApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly error: ApiError,
    public readonly requestId: string,
  ) {
    super(error.message);
    this.name = "KeepApiError";
  }
}

export class KeepClient {
  readonly #baseUrl: string;
  readonly #getAccessToken?: () => Promise<string | null>;
  readonly #fetch: typeof globalThis.fetch;

  public constructor(options: KeepClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#getAccessToken = options.getAccessToken;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  public readonly auth = {
    session: {
      get: () => this.request<SessionResponse>("/api/v1/auth/session"),
      create: (
        idToken: string,
        mfaCode?: string,
        rememberDevice = false,
        passkeyProof?: string,
      ) =>
        this.request<SessionResponse>("/api/v1/auth/session", {
          method: "POST",
          body: JSON.stringify({
            idToken,
            mfaCode,
            rememberDevice,
            passkeyProof,
          }),
        }),
      delete: () =>
        this.request<{ signedOut: true }>("/api/v1/auth/session", {
          method: "DELETE",
        }),
    },
  };

  public readonly mfa = {
    status: () => this.request<{ enabled: boolean }>("/api/v1/mfa"),
    begin: () =>
      this.request<{ secret: string; uri: string }>("/api/v1/mfa", {
        method: "POST",
      }),
    confirm: (code: string) =>
      this.request<{ enabled: true }>("/api/v1/mfa/confirm", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    remove: (code: string) =>
      this.request<{ enabled: false }>("/api/v1/mfa", {
        method: "DELETE",
        body: JSON.stringify({ code }),
      }),
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

  public readonly passwords = {
    list: () => this.request<PasswordList>("/api/v1/passwords"),
    create: (input: CreatePasswordItemRequest) =>
      this.request<{ item: PasswordItemDto }>("/api/v1/passwords", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (passwordId: string, input: UpdatePasswordItemRequest) =>
      this.request<{ item: PasswordItemDto; version: number }>(
        `/api/v1/passwords/${passwordId}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    delete: (passwordId: string, expectedVersion: number) =>
      this.request<{ deleted: true }>(`/api/v1/passwords/${passwordId}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion }),
      }),
    import: (input: ImportPasswordsRequest) =>
      this.request<ImportPasswordsResponse>("/api/v1/passwords/import", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };

  public readonly devices = {
    createAuthorization: (input: CreateDeviceAuthorizationRequest) =>
      this.request<DeviceAuthorizationResponse>(
        "/api/v1/device-authorizations",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    authorizationStatus: (authorizationId: string) =>
      this.request<{
        status: "pending" | "approved" | "used";
        expiresAt: string;
      }>(`/api/v1/device-authorizations/${authorizationId}`),
    exchange: (authorizationId: string, codeVerifier: string) =>
      this.request<
        | { status: "pending" }
        | {
            status: "authorized";
            accessToken: string;
            session: DeviceSession;
          }
      >(`/api/v1/device-authorizations/${authorizationId}/exchange`, {
        method: "POST",
        body: JSON.stringify({ codeVerifier }),
      }),
    listSessions: () =>
      this.request<DeviceSession[]>("/api/v1/device-sessions"),
    revokeSession: (sessionId: string) =>
      this.request<{ revoked: true }>(`/api/v1/device-sessions/${sessionId}`, {
        method: "DELETE",
      }),
    getVaultKey: () =>
      this.request<DeviceVaultKeyStatus>("/api/v1/device/vault-key"),
    putVaultKey: (input: DeviceWrappedVaultKey) =>
      this.request<DeviceWrappedVaultKey>("/api/v1/device/vault-key", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    deleteVaultKey: () =>
      this.request<{ deleted: true }>("/api/v1/device/vault-key", {
        method: "DELETE",
      }),
  };

  public readonly clipboard = {
    list: () => this.request<ClipboardList>("/api/v1/clipboard/items"),
    create: (input: CreateClipboardItemRequest) =>
      this.request<ClipboardItemDto>("/api/v1/clipboard/items", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    get: (itemId: string) =>
      this.request<ClipboardItemContentDto>(
        `/api/v1/clipboard/items/${itemId}`,
      ),
    delete: (itemId: string) =>
      this.request<{ deleted: true }>(`/api/v1/clipboard/items/${itemId}`, {
        method: "DELETE",
      }),
    pin: (itemId: string) =>
      this.request<ClipboardItemDto>(`/api/v1/clipboard/items/${itemId}/pin`, {
        method: "POST",
      }),
    unpin: (itemId: string) =>
      this.request<ClipboardItemDto>(
        `/api/v1/clipboard/items/${itemId}/unpin`,
        { method: "POST" },
      ),
    consume: (itemId: string) =>
      this.request<ClipboardItemContentDto>(
        `/api/v1/clipboard/items/${itemId}/consume`,
        { method: "POST" },
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
      throw new KeepApiError(
        response.status,
        errorBody.error,
        errorBody.meta.requestId,
      );
    }

    return body.data;
  }
}
