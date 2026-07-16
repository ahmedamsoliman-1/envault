import "server-only";

import type {
  CreateProjectRequest,
  ProjectDto,
  UpdateProjectRequest,
} from "@envault/api-contract";
import { type Firestore, Timestamp } from "firebase-admin/firestore";

interface ProjectDocument {
  ownerId: string;
  vaultId: string;
  name: string;
  description: string | null;
  archivedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function toDto(id: string, document: ProjectDocument): ProjectDto {
  return {
    id,
    vaultId: document.vaultId,
    name: document.name,
    description: document.description,
    archivedAt: document.archivedAt?.toDate().toISOString() ?? null,
    createdAt: document.createdAt.toDate().toISOString(),
    updatedAt: document.updatedAt.toDate().toISOString(),
  };
}

export class FirestoreProjectRepository {
  public constructor(private readonly firestore: Firestore) {}

  async #getVaultId(ownerId: string) {
    const user = await this.firestore.collection("users").doc(ownerId).get();
    const vaultId = user.get("vaultId") as string | undefined;
    return vaultId ?? null;
  }

  public async list(ownerId: string): Promise<ProjectDto[]> {
    const vaultId = await this.#getVaultId(ownerId);
    if (!vaultId) return [];

    const snapshot = await this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("projects")
      .get();

    return snapshot.docs
      .map((document) => toDto(document.id, document.data() as ProjectDocument))
      .filter((project) => project.archivedAt === null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  public async create(
    ownerId: string,
    input: CreateProjectRequest,
  ): Promise<ProjectDto | null> {
    const vaultId = await this.#getVaultId(ownerId);
    if (!vaultId) return null;

    const reference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("projects")
      .doc();
    const now = Timestamp.now();
    const project: ProjectDocument = {
      ownerId,
      vaultId,
      name: input.name,
      description: input.description,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await reference.create(project);
    return toDto(reference.id, project);
  }

  public async update(
    ownerId: string,
    projectId: string,
    input: UpdateProjectRequest,
  ) {
    const vaultId = await this.#getVaultId(ownerId);
    if (!vaultId) return null;
    const reference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("projects")
      .doc(projectId);
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.get("ownerId") !== ownerId) return null;
    await reference.update({ ...input, updatedAt: Timestamp.now() });
    const updated = await reference.get();
    return toDto(updated.id, updated.data() as ProjectDocument);
  }

  public async delete(ownerId: string, projectId: string) {
    const vaultId = await this.#getVaultId(ownerId);
    if (!vaultId) return false;
    const projectReference = this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("projects")
      .doc(projectId);
    const project = await projectReference.get();
    if (!project.exists || project.get("ownerId") !== ownerId) return false;
    const environments = await this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("environments")
      .where("projectId", "==", projectId)
      .get();
    const variables = await this.firestore
      .collection("vaults")
      .doc(vaultId)
      .collection("variables")
      .where("projectId", "==", projectId)
      .get();
    const references = [
      ...variables.docs.map((item) => item.ref),
      ...environments.docs.map((item) => item.ref),
      projectReference,
    ];
    for (let index = 0; index < references.length; index += 400) {
      const batch = this.firestore.batch();
      for (const reference of references.slice(index, index + 400)) {
        batch.delete(reference);
      }
      await batch.commit();
    }
    return true;
  }
}
