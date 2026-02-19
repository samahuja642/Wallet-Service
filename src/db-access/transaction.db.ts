import prisma from "../config/database";
import { TransactionType, TransactionStatus } from "../generated/prisma";

/**
 * Database access layer for Transaction operations.
 * Provides atomic database operations for transaction-related queries and updates.
 * All write operations are designed to be used within database transactions.
 *
 * @class TransactionDbAccess
 */
export class TransactionDbAccess {
    /**
     * Find a transaction by its idempotency key.
     * Used to prevent duplicate transactions when the same request is processed multiple times.
     *
     * @param {string} idempotencyKey - The unique idempotency key associated with the transaction
     * @returns {Promise<Object|null>} The transaction object if found, null otherwise
     * @example
     * const existing = await transactionDb.findByIdempotencyKey('unique-key-123');
     * if (existing) {
     *   return existing; // Transaction already processed
     * }
     */
    async findByIdempotencyKey(idempotencyKey: string) {
        return await prisma.transaction.findFirst({
            where: {
                metadata: {
                    path: ["idempotencyKey"],
                    equals: idempotencyKey,
                },
            },
        });
    }

    /**
     * Create a new transaction record within a database transaction.
     * The transaction is created with PENDING status and should be updated to COMPLETED after balance updates.
     *
     * @param {Object} tx - The Prisma transaction client
     * @param {Object} data - Transaction data
     * @param {string} data.senderWalletId - The unique identifier of the sender wallet
     * @param {string} data.receiverWalletId - The unique identifier of the receiver wallet
     * @param {number} data.amount - The transaction amount (must be positive)
     * @param {TransactionType} data.type - The type of transaction (DEPOSIT, WITHDRAWAL, TRANSFER)
     * @param {string} [data.description] - Optional description of the transaction
     * @param {Object} [data.metadata] - Optional metadata object (e.g., idempotencyKey)
     * @returns {Promise<Object>} The created transaction object
     * @example
     * await prisma.$transaction(async (tx) => {
     *   const transaction = await transactionDb.create(tx, {
     *     senderWalletId: 'wallet-1',
     *     receiverWalletId: 'wallet-2',
     *     amount: 100,
     *     type: TransactionType.DEPOSIT,
     *     description: 'Top-up',
     *     metadata: { idempotencyKey: 'key-123' }
     *   });
     * });
     */
    async create(
        tx: any,
        data: {
            senderWalletId: string;
            receiverWalletId: string;
            amount: number;
            type: TransactionType;
            description?: string;
            metadata?: any;
        }
    ) {
        return await tx.transaction.create({
            data: {
                senderWalletId: data.senderWalletId,
                receiverWalletId: data.receiverWalletId,
                amount: data.amount,
                type: data.type,
                status: TransactionStatus.PENDING,
                description: data.description,
                metadata: data.metadata,
            },
        });
    }

    /**
     * Update the status of a transaction within a database transaction.
     * Typically used to mark a transaction as COMPLETED after balance updates succeed.
     *
     * @param {Object} tx - The Prisma transaction client
     * @param {string} transactionId - The unique identifier of the transaction
     * @param {TransactionStatus} status - The new status (PENDING, COMPLETED, FAILED, REVERSED)
     * @returns {Promise<Object>} The updated transaction object
     * @example
     * await prisma.$transaction(async (tx) => {
     *   await transactionDb.updateStatus(tx, transactionId, TransactionStatus.COMPLETED);
     * });
     */
    async updateStatus(
        tx: any,
        transactionId: string,
        status: TransactionStatus
    ) {
        return await tx.transaction.update({
            where: { id: transactionId },
            data: { status },
        });
    }

    /**
     * Retrieve transaction history for a list of wallet IDs.
     * Returns transactions where any of the provided wallets were either sender or receiver.
     *
     * @param {string[]} walletIds - Array of wallet unique identifiers
     * @param {number} [limit=50] - Maximum number of transactions to return
     * @returns {Promise<Array>} An array of transaction objects with related wallet, user, and assetType information
     * @example
     * const transactions = await transactionDb.findByWalletIds(['wallet-1', 'wallet-2'], 100);
     * // Returns transactions involving wallet-1 or wallet-2, ordered by creation date (newest first)
     */
    async findByWalletIds(walletIds: string[], limit: number = 50, skip: number = 0) {
        return await prisma.transaction.findMany({
                where: {
                    OR: [
                        { senderWalletId: { in: walletIds } },
                        { receiverWalletId: { in: walletIds } },
                    ],
                },
                include: {
                    senderWallet: {
                        include: {
                            user: true,
                            assetType: true,
                        },
                    },
                    receiverWallet: {
                        include: {
                            user: true,
                            assetType: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
                take: limit,
                skip: skip,
            }
        );
    }

    /**
     * Find a transaction by its unique identifier.
     * Includes related wallet, user, and assetType information.
     *
     * @param {string} id - The unique identifier (UUID) of the transaction
     * @returns {Promise<Object|null>} The transaction object with related data if found, null otherwise
     * @example
     * const transaction = await transactionDb.findById('123e4567-e89b-12d3-a456-426614174000');
     */
    async findById(id: string) {
        return await prisma.transaction.findUnique({
            where: { id },
            include: {
                senderWallet: {
                    include: {
                        user: true,
                        assetType: true,
                    },
                },
                receiverWallet: {
                    include: {
                        user: true,
                        assetType: true,
                    },
                },
            },
        });
    }
}
