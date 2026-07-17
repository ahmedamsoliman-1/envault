import type {
  BulkEnvironmentRequest,
  CreateEnvironmentRequest,
  CreateProjectRequest,
  CreateVariableRequest,
  CreateVaultRequest,
  EnvironmentDto,
  ImportEnvironmentRequest,
  ProjectDto,
  UpdateEnvironmentRequest,
  UpdateProjectRequest,
  UpdateVariableRequest,
  VariableDto,
  VaultDto,
} from "@envault/api-contract";
import { createHash } from "node:crypto";

import { envaultRedisKey, type EnvaultRedis } from "./index";

interface Revision {
  id: string;
  action: string;
  variableId: string;
  snapshot: VariableDto;
  createdAt: string;
}
interface Operation {
  fingerprint: string;
  result: object;
}
interface VaultState {
  vault: VaultDto;
  projects: Record<string, ProjectDto>;
  environments: Record<string, EnvironmentDto>;
  variables: Record<string, VariableDto>;
  revisions: Revision[];
  operations: Record<string, Operation>;
}

export interface WorkspaceOverviewEnvironment extends EnvironmentDto {
  variableCount: number;
}

export interface WorkspaceOverviewProject extends ProjectDto {
  environments: WorkspaceOverviewEnvironment[];
}

export interface WorkspaceOverview {
  projectCount: number;
  environmentCount: number;
  variableCount: number;
  projects: WorkspaceOverviewProject[];
}

const userVaultKey = (ownerId: string) =>
  envaultRedisKey("user", ownerId, "vault");
const stateKey = (vaultId: string) =>
  envaultRedisKey("vault", vaultId, "state");
const overviewKey = (vaultId: string) =>
  envaultRedisKey("vault", vaultId, "overview");
const now = () => new Date().toISOString();
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function stateFor(redis: EnvaultRedis, ownerId: string) {
  const vaultId = await redis.get<string>(userVaultKey(ownerId));
  if (!vaultId) return null;
  const state = await redis.get<VaultState>(stateKey(vaultId));
  return state ? { vaultId, state } : null;
}

async function mutate<T>(
  redis: EnvaultRedis,
  ownerId: string,
  change: (state: VaultState) => T,
): Promise<T | null> {
  const vaultId = await redis.get<string>(userVaultKey(ownerId));
  if (!vaultId) return null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const key = stateKey(vaultId);
    const current = await redis.get<VaultState>(key);
    if (!current) return null;
    const before = JSON.stringify(current);
    const result = change(current);
    const after = JSON.stringify(current);
    const overview = JSON.stringify(workspaceOverview(current));
    const committed = await redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]); redis.call('SET', KEYS[2], ARGV[3]); return 1 else return 0 end",
      [key, overviewKey(vaultId)],
      [before, after, overview],
    );
    if (committed === 1) return result;
  }
  throw new Error("REDIS_CONCURRENCY_RETRY_EXHAUSTED");
}

function projectList(state: VaultState) {
  return Object.values(state.projects)
    .filter(({ archivedAt }) => archivedAt === null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
function environmentList(state: VaultState, projectId: string) {
  return Object.values(state.environments)
    .filter((item) => item.projectId === projectId && item.archivedAt === null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
function variableList(state: VaultState, environmentId: string) {
  return Object.values(state.variables).filter(
    (item) => item.environmentId === environmentId,
  );
}

function workspaceOverview(state: VaultState): WorkspaceOverview {
  const projects = projectList(state);
  const projectIds = new Set(projects.map(({ id }) => id));
  const environments = Object.values(state.environments)
    .filter(
      (environment) =>
        environment.archivedAt === null &&
        projectIds.has(environment.projectId),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const environmentIds = new Set(environments.map(({ id }) => id));
  const variableCounts = new Map<string, number>();
  let variableCount = 0;
  for (const variable of Object.values(state.variables)) {
    if (!environmentIds.has(variable.environmentId)) continue;
    variableCount += 1;
    variableCounts.set(
      variable.environmentId,
      (variableCounts.get(variable.environmentId) ?? 0) + 1,
    );
  }

  return {
    projectCount: projects.length,
    environmentCount: environments.length,
    variableCount,
    projects: projects.map((project) => ({
      ...project,
      environments: environments
        .filter(({ projectId }) => projectId === project.id)
        .map((environment) => ({
          ...environment,
          variableCount: variableCounts.get(environment.id) ?? 0,
        })),
    })),
  };
}

export class RedisVaultRepository {
  public constructor(private readonly redis: EnvaultRedis) {}
  public async findByOwnerId(ownerId: string) {
    return (await stateFor(this.redis, ownerId))?.state.vault ?? null;
  }
  public async create(ownerId: string, input: CreateVaultRequest) {
    const timestamp = now();
    const vault: VaultDto = {
      ...input,
      ownerId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const state: VaultState = {
      vault,
      projects: {},
      environments: {},
      variables: {},
      revisions: [],
      operations: {},
    };
    const result = await this.redis.eval(
      "if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end; redis.call('SET', KEYS[1], ARGV[1]); redis.call('SET', KEYS[2], ARGV[2]); redis.call('SET', KEYS[3], ARGV[3]); return 1",
      [
        userVaultKey(ownerId),
        stateKey(input.vaultId),
        overviewKey(input.vaultId),
      ],
      [
        input.vaultId,
        JSON.stringify(state),
        JSON.stringify(workspaceOverview(state)),
      ],
    );
    if (result !== 1) throw new Error("VAULT_ALREADY_EXISTS");
    return vault;
  }
}

export class RedisProjectRepository {
  public constructor(private readonly redis: EnvaultRedis) {}
  public async overview(ownerId: string): Promise<WorkspaceOverview> {
    const vaultId = await this.redis.get<string>(userVaultKey(ownerId));
    if (!vaultId)
      return {
        projectCount: 0,
        environmentCount: 0,
        variableCount: 0,
        projects: [],
      };
    const cached = await this.redis.get<WorkspaceOverview>(
      overviewKey(vaultId),
    );
    if (cached) return cached;
    const result = await stateFor(this.redis, ownerId);
    if (!result)
      return {
        projectCount: 0,
        environmentCount: 0,
        variableCount: 0,
        projects: [],
      };
    const overview = workspaceOverview(result.state);
    await this.redis.set(overviewKey(vaultId), overview);
    return overview;
  }
  public async list(ownerId: string) {
    const result = await stateFor(this.redis, ownerId);
    return result ? projectList(result.state) : [];
  }
  public async create(
    ownerId: string,
    input: CreateProjectRequest & { id?: string },
  ) {
    return mutate(this.redis, ownerId, (state) => {
      const timestamp = now();
      const id = input.id ?? crypto.randomUUID();
      const project: ProjectDto = {
        id,
        vaultId: state.vault.vaultId,
        name: input.name,
        description: input.description,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.projects[id] = project;
      return project;
    });
  }
  public async update(
    ownerId: string,
    id: string,
    input: UpdateProjectRequest,
  ) {
    return mutate(this.redis, ownerId, (state) => {
      const current = state.projects[id];
      if (!current) return null;
      const updated = { ...current, ...input, updatedAt: now() };
      state.projects[id] = updated;
      return updated;
    });
  }
  public async delete(ownerId: string, id: string) {
    return mutate(this.redis, ownerId, (state) => {
      if (!state.projects[id]) return false;
      const environmentIds = Object.values(state.environments)
        .filter(({ projectId }) => projectId === id)
        .map(({ id }) => id);
      for (const variable of Object.values(state.variables))
        if (environmentIds.includes(variable.environmentId))
          delete state.variables[variable.id];
      for (const environmentId of environmentIds)
        delete state.environments[environmentId];
      delete state.projects[id];
      return true;
    });
  }
}

export class RedisEnvironmentRepository {
  public constructor(private readonly redis: EnvaultRedis) {}
  public async list(ownerId: string, projectId: string) {
    const result = await stateFor(this.redis, ownerId);
    return result ? environmentList(result.state, projectId) : [];
  }
  public async create(
    ownerId: string,
    projectId: string,
    input: CreateEnvironmentRequest,
  ) {
    return mutate(this.redis, ownerId, (state) => {
      if (!state.projects[projectId]) return null;
      const timestamp = now();
      const id = crypto.randomUUID();
      const environment: EnvironmentDto = {
        id,
        vaultId: state.vault.vaultId,
        projectId,
        name: input.name,
        kind: input.kind,
        version: 0,
        contentRevision: crypto.randomUUID(),
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.environments[id] = environment;
      return environment;
    });
  }
  public async listVariables(ownerId: string, environmentId: string) {
    const result = await stateFor(this.redis, ownerId);
    const environment = result?.state.environments[environmentId];
    return result && environment
      ? {
          variables: variableList(result.state, environmentId),
          version: environment.version,
        }
      : null;
  }
  public async createVariable(
    ownerId: string,
    environmentId: string,
    input: CreateVariableRequest,
  ) {
    return mutate(this.redis, ownerId, (state) => {
      const environment = state.environments[environmentId];
      if (!environment) return null;
      if (environment.version !== input.expectedVersion)
        return { conflictVersion: environment.version };
      if (
        variableList(state, environmentId).some(
          ({ key }) => key.toUpperCase() === input.key.toUpperCase(),
        )
      )
        return { duplicate: true as const };
      const timestamp = now();
      const variable: VariableDto = {
        ...input,
        vaultId: state.vault.vaultId,
        environmentId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      delete (variable as Partial<CreateVariableRequest>).expectedVersion;
      state.variables[input.id] = variable;
      state.revisions.push({
        id: crypto.randomUUID(),
        action: "created",
        variableId: input.id,
        snapshot: variable,
        createdAt: timestamp,
      });
      environment.version += 1;
      environment.contentRevision = crypto.randomUUID();
      environment.updatedAt = timestamp;
      return { variable, version: environment.version };
    });
  }

  public async updateEnvironment(
    ownerId: string,
    environmentId: string,
    input: UpdateEnvironmentRequest,
  ) {
    return mutate(this.redis, ownerId, (state) => {
      const environment = state.environments[environmentId];
      if (!environment) return null;
      if (environment.version !== input.expectedVersion)
        return { conflictVersion: environment.version };
      const updated = {
        ...environment,
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        version: environment.version + 1,
        contentRevision: crypto.randomUUID(),
        updatedAt: now(),
      };
      state.environments[environmentId] = updated;
      return updated;
    });
  }

  public async deleteEnvironment(
    ownerId: string,
    environmentId: string,
    expectedVersion: number,
  ) {
    return mutate(this.redis, ownerId, (state) => {
      const environment = state.environments[environmentId];
      if (!environment) return null;
      if (environment.version !== expectedVersion)
        return { conflictVersion: environment.version };
      for (const variable of variableList(state, environmentId))
        delete state.variables[variable.id];
      delete state.environments[environmentId];
      return { deleted: true as const };
    });
  }

  public async updateVariable(
    ownerId: string,
    variableId: string,
    input: UpdateVariableRequest,
  ) {
    return mutate(this.redis, ownerId, (state) => {
      const variable = state.variables[variableId];
      if (!variable) return null;
      const environment = state.environments[variable.environmentId];
      if (!environment) return null;
      if (!environment) return null;
      if (environment.version !== input.expectedVersion)
        return { conflictVersion: environment.version };
      if (
        input.key &&
        variableList(state, variable.environmentId).some(
          (item) =>
            item.id !== variableId &&
            item.key.toUpperCase() === input.key?.toUpperCase(),
        )
      )
        return { duplicate: true as const };
      const timestamp = now();
      state.revisions.push({
        id: crypto.randomUUID(),
        action: "updated",
        variableId,
        snapshot: variable,
        createdAt: timestamp,
      });
      const updated = {
        ...variable,
        ...Object.fromEntries(
          Object.entries(input).filter(
            ([key, value]) => key !== "expectedVersion" && value !== undefined,
          ),
        ),
        updatedAt: timestamp,
      };
      state.variables[variableId] = updated;
      environment.version += 1;
      environment.contentRevision = crypto.randomUUID();
      environment.updatedAt = timestamp;
      return { variable: updated, version: environment.version };
    });
  }

  public async deleteVariable(
    ownerId: string,
    variableId: string,
    expectedVersion: number,
  ) {
    return mutate(this.redis, ownerId, (state) => {
      const variable = state.variables[variableId];
      if (!variable) return null;
      const environment = state.environments[variable.environmentId];
      if (!environment) return null;
      if (environment.version !== expectedVersion)
        return { conflictVersion: environment.version };
      const timestamp = now();
      state.revisions.push({
        id: crypto.randomUUID(),
        action: "deleted",
        variableId,
        snapshot: variable,
        createdAt: timestamp,
      });
      delete state.variables[variableId];
      environment.version += 1;
      environment.contentRevision = crypto.randomUUID();
      environment.updatedAt = timestamp;
      return { deleted: true as const, version: environment.version };
    });
  }

  public async importVariables(
    ownerId: string,
    environmentId: string,
    input: ImportEnvironmentRequest,
  ) {
    return mutate(this.redis, ownerId, (state) => {
      const operationFingerprint = fingerprint({
        environmentId,
        ...input,
      });
      const previous = state.operations[input.operationId];
      if (previous)
        return previous.fingerprint === operationFingerprint
          ? previous.result
          : { idempotencyConflict: true as const };
      const environment = state.environments[environmentId];
      if (!environment) return null;
      if (environment.version !== input.expectedVersion)
        return { conflictVersion: environment.version };
      const existingByKey = new Map(
        variableList(state, environmentId).map((item) => [
          item.key.toUpperCase(),
          item,
        ]),
      );
      const timestamp = now();
      const imported: VariableDto[] = [];
      for (const item of input.variables) {
        const existing = existingByKey.get(item.key.toUpperCase());
        if (existing && existing.id !== item.id)
          return { identityConflict: true as const };
        if (existing)
          state.revisions.push({
            id: crypto.randomUUID(),
            action: "updated",
            variableId: existing.id,
            snapshot: existing,
            createdAt: timestamp,
          });
        const variable: VariableDto = {
          ...item,
          vaultId: state.vault.vaultId,
          environmentId,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        state.variables[item.id] = variable;
        imported.push(variable);
      }
      environment.version += 1;
      environment.contentRevision = crypto.randomUUID();
      environment.updatedAt = timestamp;
      const result = {
        replayed: false,
        variables: imported,
        version: environment.version,
      };
      state.operations[input.operationId] = {
        fingerprint: operationFingerprint,
        result: { ...result, replayed: true },
      };
      return result;
    });
  }

  public async bulkVariables(
    ownerId: string,
    environmentId: string,
    input: BulkEnvironmentRequest,
  ) {
    return mutate(this.redis, ownerId, (state) => {
      const operationFingerprint = fingerprint({
        environmentId,
        ...input,
      });
      const previous = state.operations[input.operationId];
      if (previous)
        return previous.fingerprint === operationFingerprint
          ? previous.result
          : { idempotencyConflict: true as const };
      const environment = state.environments[environmentId];
      if (!environment) return null;
      if (environment.version !== input.expectedVersion)
        return { conflictVersion: environment.version };
      const selected = new Set([
        ...input.updates.map(({ id }) => id),
        ...input.deleteIds,
      ]);
      if ([...selected].some((id) => !state.variables[id]))
        return { missingVariable: true as const };
      const finalKeys = new Map<string, string>();
      const updates = new Map(input.updates.map((item) => [item.id, item]));
      for (const variable of variableList(state, environmentId)) {
        if (input.deleteIds.includes(variable.id)) continue;
        const key = updates.get(variable.id)?.key ?? variable.key;
        const normalized = key.toUpperCase();
        if (finalKeys.has(normalized)) return { duplicate: true as const };
        finalKeys.set(normalized, variable.id);
      }
      const timestamp = now();
      const changed: VariableDto[] = [];
      for (const update of input.updates) {
        const variable = state.variables[update.id]!;
        state.revisions.push({
          id: crypto.randomUUID(),
          action: "updated",
          variableId: variable.id,
          snapshot: variable,
          createdAt: timestamp,
        });
        const updated = { ...variable, ...update, updatedAt: timestamp };
        state.variables[update.id] = updated;
        changed.push(updated);
      }
      for (const id of input.deleteIds) {
        const variable = state.variables[id]!;
        state.revisions.push({
          id: crypto.randomUUID(),
          action: "deleted",
          variableId: id,
          snapshot: variable,
          createdAt: timestamp,
        });
        delete state.variables[id];
      }
      environment.version += 1;
      environment.contentRevision = crypto.randomUUID();
      environment.updatedAt = timestamp;
      const result = {
        replayed: false,
        variables: changed,
        deletedIds: input.deleteIds,
        version: environment.version,
      };
      state.operations[input.operationId] = {
        fingerprint: operationFingerprint,
        result: { ...result, replayed: true },
      };
      return result;
    });
  }
}
