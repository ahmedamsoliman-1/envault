import "server-only";

import type { CreateVaultRequest, VaultDto } from "@envault/api-contract";
import { type Firestore, Timestamp } from "firebase-admin/firestore";

interface VaultDocument extends Omit<VaultDto, "createdAt" | "updatedAt"> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function toDto(document: VaultDocument): VaultDto {
  return {
    ...document,
    createdAt: document.createdAt.toDate().toISOString(),
    updatedAt: document.updatedAt.toDate().toISOString(),
  };
}

export class FirestoreVaultRepository {
  public constructor(private readonly firestore: Firestore) {}

  public async findByOwnerId(ownerId: string): Promise<VaultDto | null> {
    const snapshot = await this.firestore
      .collection("vaults")
      .where("ownerId", "==", ownerId)
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    return document ? toDto(document.data() as VaultDocument) : null;
  }

  public async create(
    ownerId: string,
    input: CreateVaultRequest,
  ): Promise<VaultDto> {
    const reference = this.firestore.collection("vaults").doc(input.vaultId);
    const now = Timestamp.now();
    const vault: VaultDocument = {
      ...input,
      ownerId,
      createdAt: now,
      updatedAt: now,
    };

    await this.firestore.runTransaction(async (transaction) => {
      const existingOwnerVault = await transaction.get(
        this.firestore.collection("users").doc(ownerId),
      );
      const existingVault = await transaction.get(reference);
      if (existingOwnerVault.exists || existingVault.exists) {
        throw new Error("VAULT_ALREADY_EXISTS");
      }

      transaction.create(reference, vault);
      transaction.create(this.firestore.collection("users").doc(ownerId), {
        ownerId,
        vaultId: input.vaultId,
        createdAt: now,
        updatedAt: now,
      });
    });

    return toDto(vault);
  }
}
