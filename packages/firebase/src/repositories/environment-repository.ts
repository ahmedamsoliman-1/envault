import "server-only";

import { createHash } from "node:crypto";

import type {
  BulkEnvironmentRequest,
  CreateEnvironmentRequest,
  CreateVariableRequest,
  ImportEnvironmentRequest,
  UpdateEnvironmentRequest,
  UpdateVariableRequest,
  EnvironmentDto,
  VariableDto,
} from "@envault/api-contract";
import { type Firestore, Timestamp } from "firebase-admin/firestore";

interface EnvironmentDocument {
  ownerId: string;
  vaultId: string;
  projectId: string;
  name: string;
  kind: EnvironmentDto["kind"];
  version: number;
  contentRevision: string;
  archivedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface VariableDocument {
  ownerId: string;
  vaultId: string;
  projectId: string;
  environmentId: string;
  key: string;
  normalizedKey: string;
  encryptedValue: string;
  encryptionIv: string;
  encryptionVersion: number;
  visibility: VariableDto["visibility"];
  tags: string[];
  description: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ImportOperationDocument {
  ownerId: string;
  vaultId: string;
  environmentId: string;
  kind: "environment-import" | "environment-bulk";
  fingerprint: string;
  variableIds?: string[];
  updatedIds?: string[];
  deletedIds?: string[];
  resultingVersion: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function environmentDto(
  id: string,
  value: EnvironmentDocument,
): EnvironmentDto {
  return {
    id,
    vaultId: value.vaultId,
    projectId: value.projectId,
    name: value.name,
    kind: value.kind,
    version: value.version,
    contentRevision: value.contentRevision,
    archivedAt: value.archivedAt?.toDate().toISOString() ?? null,
    createdAt: value.createdAt.toDate().toISOString(),
    updatedAt: value.updatedAt.toDate().toISOString(),
  };
}

function variableDto(id: string, value: VariableDocument): VariableDto {
  return {
    id,
    vaultId: value.vaultId,
    projectId: value.projectId,
    environmentId: value.environmentId,
    key: value.key,
    encryptedValue: value.encryptedValue,
    encryptionIv: value.encryptionIv,
    encryptionVersion: value.encryptionVersion,
    visibility: value.visibility,
    tags: value.tags,
    description: value.description,
    createdAt: value.createdAt.toDate().toISOString(),
    updatedAt: value.updatedAt.toDate().toISOString(),
  };
}

export class FirestoreEnvironmentRepository {
  public constructor(private readonly firestore: Firestore) {}

  async #vaultId(ownerId: string) {
    const user = await this.firestore.collection("users").doc(ownerId).get();
    return (user.get("vaultId") as string | undefined) ?? null;
  }

  public async list(ownerId: string, projectId: string) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return [];
    const snapshot = await this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("environments")
      .where("projectId", "==", projectId)
      .get();
    return snapshot.docs
      .map((item) =>
        environmentDto(item.id, item.data() as EnvironmentDocument),
      )
      .filter((item) => item.archivedAt === null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public async create(
    ownerId: string,
    projectId: string,
    input: CreateEnvironmentRequest,
  ) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return null;
    const reference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("environments")
      .doc();
    const now = Timestamp.now();
    const value: EnvironmentDocument = {
      ownerId,
      vaultId,
      projectId,
      name: input.name,
      kind: input.kind,
      version: 0,
      contentRevision: crypto.randomUUID(),
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await reference.create(value);
    return environmentDto(reference.id, value);
  }

  public async listVariables(ownerId: string, environmentId: string) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return null;
    const environmentReference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("environments")
      .doc(environmentId);
    const [environment, variables] = await Promise.all([
      environmentReference.get(),
      this.firestore
        .collection("vaults")
        .doc(vaultId)
        .collection("variables")
        .where("environmentId", "==", environmentId)
        .get(),
    ]);
    if (!environment.exists || environment.get("ownerId") !== ownerId)
      return null;
    return {
      variables: variables.docs.map((item) =>
        variableDto(item.id, item.data() as VariableDocument),
      ),
      version: environment.get("version") as number,
    };
  }

  public async createVariable(
    ownerId: string,
    environmentId: string,
    input: CreateVariableRequest,
  ) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return null;
    const environmentReference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("environments")
      .doc(environmentId);
    const variableReference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("variables")
      .doc(input.id);

    return this.firestore.runTransaction(async (transaction) => {
      const environment = await transaction.get(environmentReference);
      if (!environment.exists || environment.get("ownerId") !== ownerId)
        return null;
      const currentVersion = environment.get("version") as number;
      if (currentVersion !== input.expectedVersion) {
        return { conflictVersion: currentVersion };
      }
      const existingKey = await transaction.get(
        this.firestore
          .collection("vaults")
          .doc(vaultId)
          .collection("variables")
          .where("environmentId", "==", environmentId),
      );
      if (
        existingKey.docs.some(
          (document) =>
            document.get("normalizedKey") === input.key.toUpperCase(),
        )
      ) {
        return { duplicate: true as const };
      }

      const now = Timestamp.now();
      const value: VariableDocument = {
        ownerId,
        vaultId,
        projectId: input.projectId,
        environmentId,
        key: input.key,
        normalizedKey: input.key.toUpperCase(),
        encryptedValue: input.encryptedValue,
        encryptionIv: input.encryptionIv,
        encryptionVersion: input.encryptionVersion,
        visibility: input.visibility,
        tags: input.tags,
        description: input.description,
        createdAt: now,
        updatedAt: now,
      };
      transaction.create(variableReference, value);
      transaction.create(
        this.firestore
          .collection("vaults")
          .doc(vaultId)
          .collection("revisions")
          .doc(),
        {
          ownerId,
          vaultId,
          projectId: input.projectId,
          environmentId,
          variableId: input.id,
          action: "created",
          snapshot: value,
          createdAt: now,
          updatedAt: now,
        },
      );
      transaction.update(environmentReference, {
        version: currentVersion + 1,
        contentRevision: crypto.randomUUID(),
        updatedAt: now,
      });
      return {
        variable: variableDto(variableReference.id, value),
        version: currentVersion + 1,
      };
    });
  }

  public async importVariables(
    ownerId: string,
    environmentId: string,
    input: ImportEnvironmentRequest,
  ) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return null;

    const vaultReference = this.firestore.collection("vaults").doc(vaultId);
    const environmentReference = vaultReference
      .collection("environments")
      .doc(environmentId);
    const variablesCollection = vaultReference.collection("variables");
    const operationReference = vaultReference
      .collection("operations")
      .doc(input.operationId);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          environmentId,
          expectedVersion: input.expectedVersion,
          variables: input.variables,
        }),
      )
      .digest("hex");

    const transactionResult = await this.firestore.runTransaction(
      async (transaction) => {
        const [environment, operation, existingVariables] = await Promise.all([
          transaction.get(environmentReference),
          transaction.get(operationReference),
          transaction.get(
            variablesCollection.where("environmentId", "==", environmentId),
          ),
        ]);

        if (!environment.exists || environment.get("ownerId") !== ownerId) {
          return null;
        }

        if (operation.exists) {
          const previous = operation.data() as ImportOperationDocument;
          if (
            previous.ownerId !== ownerId ||
            previous.environmentId !== environmentId ||
            previous.kind !== "environment-import" ||
            previous.fingerprint !== fingerprint
          ) {
            return { idempotencyConflict: true as const };
          }
          return {
            replayed: true as const,
            variableIds: previous.variableIds,
            version: previous.resultingVersion,
          };
        }

        const currentVersion = environment.get("version") as number;
        if (currentVersion !== input.expectedVersion) {
          return { conflictVersion: currentVersion };
        }

        const existingByKey = new Map(
          existingVariables.docs.map((document) => [
            document.get("normalizedKey") as string,
            document,
          ]),
        );
        const now = Timestamp.now();
        const imported: Array<{ id: string; value: VariableDocument }> = [];

        for (const variable of input.variables) {
          const existing = existingByKey.get(variable.key.toUpperCase());
          if (existing && existing.id !== variable.id) {
            return { identityConflict: true as const };
          }

          const reference = variablesCollection.doc(variable.id);
          if (existing) {
            const previous = existing.data() as VariableDocument;
            const updated: VariableDocument = {
              ...previous,
              key: variable.key,
              normalizedKey: variable.key.toUpperCase(),
              encryptedValue: variable.encryptedValue,
              encryptionIv: variable.encryptionIv,
              encryptionVersion: variable.encryptionVersion,
              visibility: variable.visibility,
              tags: variable.tags,
              description: variable.description,
              updatedAt: now,
            };
            transaction.create(vaultReference.collection("revisions").doc(), {
              ownerId,
              vaultId,
              projectId: previous.projectId,
              environmentId,
              variableId: variable.id,
              action: "updated",
              snapshot: previous,
              createdAt: now,
              updatedAt: now,
            });
            transaction.update(reference, { ...updated });
            imported.push({ id: variable.id, value: updated });
          } else {
            const created: VariableDocument = {
              ownerId,
              vaultId,
              projectId: variable.projectId,
              environmentId,
              key: variable.key,
              normalizedKey: variable.key.toUpperCase(),
              encryptedValue: variable.encryptedValue,
              encryptionIv: variable.encryptionIv,
              encryptionVersion: variable.encryptionVersion,
              visibility: variable.visibility,
              tags: variable.tags,
              description: variable.description,
              createdAt: now,
              updatedAt: now,
            };
            transaction.create(reference, created);
            transaction.create(vaultReference.collection("revisions").doc(), {
              ownerId,
              vaultId,
              projectId: variable.projectId,
              environmentId,
              variableId: variable.id,
              action: "created",
              snapshot: created,
              createdAt: now,
              updatedAt: now,
            });
            imported.push({ id: variable.id, value: created });
          }
        }

        const resultingVersion = currentVersion + 1;
        transaction.update(environmentReference, {
          version: resultingVersion,
          contentRevision: crypto.randomUUID(),
          updatedAt: now,
        });
        transaction.create(operationReference, {
          ownerId,
          vaultId,
          environmentId,
          kind: "environment-import",
          fingerprint,
          variableIds: imported.map(({ id }) => id),
          resultingVersion,
          createdAt: now,
          updatedAt: now,
        } satisfies ImportOperationDocument);

        return {
          replayed: false as const,
          variables: imported.map(({ id, value }) => variableDto(id, value)),
          version: resultingVersion,
        };
      },
    );

    if (
      !transactionResult ||
      "conflictVersion" in transactionResult ||
      "idempotencyConflict" in transactionResult ||
      "identityConflict" in transactionResult ||
      !transactionResult.replayed
    ) {
      return transactionResult;
    }

    const replayedVariables = await Promise.all(
      (transactionResult.variableIds ?? []).map((id) =>
        variablesCollection.doc(id).get(),
      ),
    );
    return {
      replayed: true as const,
      variables: replayedVariables
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) =>
          variableDto(snapshot.id, snapshot.data() as VariableDocument),
        ),
      version: transactionResult.version,
    };
  }

  public async bulkVariables(
    ownerId: string,
    environmentId: string,
    input: BulkEnvironmentRequest,
  ) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return null;

    const vaultReference = this.firestore.collection("vaults").doc(vaultId);
    const environmentReference = vaultReference
      .collection("environments")
      .doc(environmentId);
    const variablesCollection = vaultReference.collection("variables");
    const operationReference = vaultReference
      .collection("operations")
      .doc(input.operationId);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ environmentId, ...input }))
      .digest("hex");

    const transactionResult = await this.firestore.runTransaction(
      async (transaction) => {
        const [environment, operation, variables] = await Promise.all([
          transaction.get(environmentReference),
          transaction.get(operationReference),
          transaction.get(
            variablesCollection.where("environmentId", "==", environmentId),
          ),
        ]);

        if (!environment.exists || environment.get("ownerId") !== ownerId) {
          return null;
        }
        if (operation.exists) {
          const previous = operation.data() as ImportOperationDocument;
          if (
            previous.ownerId !== ownerId ||
            previous.environmentId !== environmentId ||
            previous.kind !== "environment-bulk" ||
            previous.fingerprint !== fingerprint
          ) {
            return { idempotencyConflict: true as const };
          }
          return {
            replayed: true as const,
            updatedIds: previous.updatedIds ?? [],
            deletedIds: previous.deletedIds ?? [],
            version: previous.resultingVersion,
          };
        }

        const currentVersion = environment.get("version") as number;
        if (currentVersion !== input.expectedVersion) {
          return { conflictVersion: currentVersion };
        }

        const byId = new Map(
          variables.docs.map((document) => [document.id, document]),
        );
        const deleteIds = new Set(input.deleteIds);
        const updateById = new Map(
          input.updates.map((update) => [update.id, update]),
        );
        const requestedIds = new Set([...deleteIds, ...updateById.keys()]);
        if (
          [...requestedIds].some((id) => {
            const document = byId.get(id);
            return !document || document.get("ownerId") !== ownerId;
          })
        ) {
          return { missingVariable: true as const };
        }

        const finalKeys = new Map<string, string>();
        for (const document of variables.docs) {
          if (deleteIds.has(document.id)) continue;
          const update = updateById.get(document.id);
          const normalized = (
            update?.key ?? (document.get("key") as string)
          ).toUpperCase();
          const collision = finalKeys.get(normalized);
          if (collision && collision !== document.id) {
            return { duplicate: true as const };
          }
          finalKeys.set(normalized, document.id);
        }

        const now = Timestamp.now();
        const updated: Array<{ id: string; value: VariableDocument }> = [];

        for (const update of input.updates) {
          const document = byId.get(update.id);
          if (!document) return { missingVariable: true as const };
          const previous = document.data() as VariableDocument;
          const value: VariableDocument = {
            ...previous,
            ...(update.key === undefined
              ? {}
              : { key: update.key, normalizedKey: update.key.toUpperCase() }),
            ...(update.visibility === undefined
              ? {}
              : { visibility: update.visibility }),
            ...(update.tags === undefined ? {} : { tags: update.tags }),
            updatedAt: now,
          };
          transaction.create(vaultReference.collection("revisions").doc(), {
            ownerId,
            vaultId,
            projectId: previous.projectId,
            environmentId,
            variableId: update.id,
            action: "updated",
            snapshot: previous,
            createdAt: now,
            updatedAt: now,
          });
          transaction.update(document.ref, { ...value });
          updated.push({ id: update.id, value });
        }

        for (const id of input.deleteIds) {
          const document = byId.get(id);
          if (!document) return { missingVariable: true as const };
          const previous = document.data() as VariableDocument;
          transaction.create(vaultReference.collection("revisions").doc(), {
            ownerId,
            vaultId,
            projectId: previous.projectId,
            environmentId,
            variableId: id,
            action: "deleted",
            snapshot: previous,
            createdAt: now,
            updatedAt: now,
          });
          transaction.delete(document.ref);
        }

        const resultingVersion = currentVersion + 1;
        transaction.update(environmentReference, {
          version: resultingVersion,
          contentRevision: crypto.randomUUID(),
          updatedAt: now,
        });
        transaction.create(operationReference, {
          ownerId,
          vaultId,
          environmentId,
          kind: "environment-bulk",
          fingerprint,
          updatedIds: updated.map(({ id }) => id),
          deletedIds: input.deleteIds,
          resultingVersion,
          createdAt: now,
          updatedAt: now,
        } satisfies ImportOperationDocument);

        return {
          replayed: false as const,
          variables: updated.map(({ id, value }) => variableDto(id, value)),
          deletedIds: input.deleteIds,
          version: resultingVersion,
        };
      },
    );

    if (
      !transactionResult ||
      "conflictVersion" in transactionResult ||
      "idempotencyConflict" in transactionResult ||
      "missingVariable" in transactionResult ||
      "duplicate" in transactionResult ||
      !transactionResult.replayed
    ) {
      return transactionResult;
    }

    const replayedVariables = await Promise.all(
      transactionResult.updatedIds.map((id) =>
        variablesCollection.doc(id).get(),
      ),
    );
    return {
      replayed: true as const,
      variables: replayedVariables
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) =>
          variableDto(snapshot.id, snapshot.data() as VariableDocument),
        ),
      deletedIds: transactionResult.deletedIds,
      version: transactionResult.version,
    };
  }

  public async updateEnvironment(
    ownerId: string,
    environmentId: string,
    input: UpdateEnvironmentRequest,
  ) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return null;
    const reference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("environments")
      .doc(environmentId);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || snapshot.get("ownerId") !== ownerId) return null;
      const currentVersion = snapshot.get("version") as number;
      if (currentVersion !== input.expectedVersion)
        return { conflictVersion: currentVersion };
      const now = Timestamp.now();
      const contentRevision = crypto.randomUUID();
      transaction.update(reference, {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        version: currentVersion + 1,
        contentRevision,
        updatedAt: now,
      });
      return environmentDto(environmentId, {
        ...(snapshot.data() as EnvironmentDocument),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        version: currentVersion + 1,
        contentRevision,
        updatedAt: now,
      });
    });
  }

  public async deleteEnvironment(
    ownerId: string,
    environmentId: string,
    expectedVersion: number,
  ) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return null;
    const reference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("environments")
      .doc(environmentId);
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.get("ownerId") !== ownerId) return null;
    const currentVersion = snapshot.get("version") as number;
    if (currentVersion !== expectedVersion)
      return { conflictVersion: currentVersion };
    const variables = await this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("variables")
      .where("environmentId", "==", environmentId)
      .get();
    const references = [...variables.docs.map((item) => item.ref), reference];
    for (let index = 0; index < references.length; index += 400) {
      const batch = this.firestore.batch();
      for (const item of references.slice(index, index + 400))
        batch.delete(item);
      await batch.commit();
    }
    return { deleted: true as const };
  }

  public async updateVariable(
    ownerId: string,
    variableId: string,
    input: UpdateVariableRequest,
  ) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return null;
    const variableReference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("variables")
      .doc(variableId);
    return this.firestore.runTransaction(async (transaction) => {
      const variable = await transaction.get(variableReference);
      if (!variable.exists || variable.get("ownerId") !== ownerId) return null;
      const environmentId = variable.get("environmentId") as string;
      const environmentReference = this.firestore
        .collection("vaults")
        .doc(vaultId)
        .collection("environments")
        .doc(environmentId);
      const environment = await transaction.get(environmentReference);
      const currentVersion = environment.get("version") as number;
      if (currentVersion !== input.expectedVersion)
        return { conflictVersion: currentVersion };
      if (input.key !== undefined) {
        const keys = await transaction.get(
          this.firestore
            .collection("vaults")
            .doc(vaultId)
            .collection("variables")
            .where("environmentId", "==", environmentId),
        );
        if (
          keys.docs.some(
            (document) =>
              document.id !== variableId &&
              document.get("normalizedKey") === input.key?.toUpperCase(),
          )
        ) {
          return { duplicate: true as const };
        }
      }
      const now = Timestamp.now();
      const previous = variable.data() as VariableDocument;
      const updated: VariableDocument = {
        ...previous,
        ...(input.key === undefined
          ? {}
          : { key: input.key, normalizedKey: input.key.toUpperCase() }),
        ...(input.encryptedValue === undefined
          ? {}
          : { encryptedValue: input.encryptedValue }),
        ...(input.encryptionIv === undefined
          ? {}
          : { encryptionIv: input.encryptionIv }),
        ...(input.encryptionVersion === undefined
          ? {}
          : { encryptionVersion: input.encryptionVersion }),
        ...(input.visibility === undefined
          ? {}
          : { visibility: input.visibility }),
        ...(input.tags === undefined ? {} : { tags: input.tags }),
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
        updatedAt: now,
      };
      transaction.create(
        this.firestore
          .collection("vaults")
          .doc(vaultId)
          .collection("revisions")
          .doc(),
        {
          ownerId,
          vaultId,
          projectId: previous.projectId,
          environmentId,
          variableId,
          action: "updated",
          snapshot: previous,
          createdAt: now,
          updatedAt: now,
        },
      );
      transaction.update(variableReference, { ...updated });
      transaction.update(environmentReference, {
        version: currentVersion + 1,
        contentRevision: crypto.randomUUID(),
        updatedAt: now,
      });
      return {
        variable: variableDto(variableId, updated),
        version: currentVersion + 1,
      };
    });
  }

  public async deleteVariable(
    ownerId: string,
    variableId: string,
    expectedVersion: number,
  ) {
    const vaultId = await this.#vaultId(ownerId);
    if (!vaultId) return null;
    const variableReference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("variables")
      .doc(variableId);
    return this.firestore.runTransaction(async (transaction) => {
      const variable = await transaction.get(variableReference);
      if (!variable.exists || variable.get("ownerId") !== ownerId) return null;
      const previous = variable.data() as VariableDocument;
      const environmentReference = this.firestore
        .collection("vaults")
        .doc(vaultId)
        .collection("environments")
        .doc(previous.environmentId);
      const environment = await transaction.get(environmentReference);
      const currentVersion = environment.get("version") as number;
      if (currentVersion !== expectedVersion)
        return { conflictVersion: currentVersion };
      const now = Timestamp.now();
      transaction.create(
        this.firestore
          .collection("vaults")
          .doc(vaultId)
          .collection("revisions")
          .doc(),
        {
          ownerId,
          vaultId,
          projectId: previous.projectId,
          environmentId: previous.environmentId,
          variableId,
          action: "deleted",
          snapshot: previous,
          createdAt: now,
          updatedAt: now,
        },
      );
      transaction.delete(variableReference);
      transaction.update(environmentReference, {
        version: currentVersion + 1,
        contentRevision: crypto.randomUUID(),
        updatedAt: now,
      });
      return { deleted: true as const, version: currentVersion + 1 };
    });
  }
}
