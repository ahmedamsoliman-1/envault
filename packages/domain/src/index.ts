export * from "./clipboard";

export type EntityId = string;

export interface AuditedEntity {
  id: EntityId;
  ownerId: EntityId;
  vaultId: EntityId;
  createdAt: Date;
  updatedAt: Date;
}

export type EnvironmentKind =
  "local" | "development" | "testing" | "staging" | "production" | "custom";

export interface Project extends AuditedEntity {
  name: string;
  description: string | null;
  archivedAt: Date | null;
}

export interface Environment extends AuditedEntity {
  projectId: EntityId;
  name: string;
  kind: EnvironmentKind;
  version: number;
  contentRevision: string;
  archivedAt: Date | null;
}

export type VariableVisibility = "secret" | "protected" | "plain";

export interface Variable extends AuditedEntity {
  projectId: EntityId;
  environmentId: EntityId;
  key: string;
  normalizedKey: string;
  encryptedValue: string;
  encryptionIv: string;
  encryptionVersion: number;
  visibility: VariableVisibility;
  tags: string[];
  description: string | null;
}

export interface ProjectRepository {
  findById(
    ownerId: EntityId,
    vaultId: EntityId,
    projectId: EntityId,
  ): Promise<Project | null>;
  list(ownerId: EntityId, vaultId: EntityId): Promise<Project[]>;
  save(project: Project): Promise<void>;
}

export interface EnvironmentRepository {
  findById(
    ownerId: EntityId,
    vaultId: EntityId,
    environmentId: EntityId,
  ): Promise<Environment | null>;
  listByProject(
    ownerId: EntityId,
    vaultId: EntityId,
    projectId: EntityId,
  ): Promise<Environment[]>;
  save(environment: Environment): Promise<void>;
}
