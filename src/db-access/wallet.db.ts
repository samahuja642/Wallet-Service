import prisma from "../config/database";

/**
 * Database access layer for Wallet operations.
 * Provides atomic database operations for wallet-related queries and updates.
 * All write operations are designed to be used within database transactions.
 *
 * @class WalletDbAccess
 */
export class WalletDbAccess {
    /**
     * Find a wallet by user ID and asset type ID.
     *
     * @param {string} userId - The unique identifier of the user
     * @param {string} assetTypeId - The unique identifier of the asset type
     * @returns {Promise<Object|null>} The wallet object with related assetType and user, null if not found
     * @example
     * const wallet = await walletDb.findByUserAndAssetType(userId, assetTypeId);
     */
    async findByUserAndAssetType(userId: string, assetTypeId: string) {
        return await prisma.wallet.findUnique({
            where: {
                userId_assetTypeId: {
                    userId,
                    assetTypeId,
                },
            },
            include: {
                assetType: true,
                user: true,
            },
        });
    }

    /**
     * Find a wallet by its unique identifier.
     *
     * @param {string} id - The unique identifier (UUID) of the wallet
     * @returns {Promise<Object|null>} The wallet object with related assetType and user, null if not found
     * @example
     * const wallet = await walletDb.findById('123e4567-e89b-12d3-a456-426614174000');
     */
    async findById(id: string) {
        return await prisma.wallet.findUnique({
            where: { id },
            include: {
                assetType: true,
                user: true,
            },
        });
    }

    /**
     * Retrieve all wallets for a specific user.
     *
     * @param {string} userId - The unique identifier of the user
     * @returns {Promise<Array>} An array of wallet objects with related assetType information
     * @example
     * const wallets = await walletDb.findByUserId(userId);
     * // Returns all wallets (GOLD, DIAMOND, LOYALTY_POINTS) for the user
     */
    async findByUserId(userId: string) {
        return await prisma.wallet.findMany({
            where: { userId },
            include: {
                assetType: true,
            },
        });
    }

    /**
     * Get or create a wallet for a user and asset type (atomic upsert operation).
     * If the wallet exists, returns it. If not, creates a new wallet with balance 0.
     *
     * @param {string} userId - The unique identifier of the user
     * @param {string} assetTypeId - The unique identifier of the asset type
     * @returns {Promise<Object>} The wallet object with related assetType
     * @example
     * const wallet = await walletDb.getOrCreate(userId, assetTypeId);
     */
    async getOrCreate(userId: string, assetTypeId: string) {
        return await prisma.wallet.upsert({
            where: {
                userId_assetTypeId: {
                    userId,
                    assetTypeId,
                },
            },
            update: {},
            create: {
                userId,
                assetTypeId,
                balance: 0,
            },
            include: {
                assetType: true,
            },
        });
    }

    /**
     * Get or create a wallet within a database transaction (atomic operation).
     * This method should be used when the operation is part of a larger transaction.
     *
     * @param {Object} tx - The Prisma transaction client
     * @param {string} userId - The unique identifier of the user
     * @param {string} assetTypeId - The unique identifier of the asset type
     * @returns {Promise<Object>} The wallet object
     * @example
     * await prisma.$transaction(async (tx) => {
     *   const wallet = await walletDb.getOrCreateInTransaction(tx, userId, assetTypeId);
     *   // ... other operations
     * });
     */
    async getOrCreateInTransaction(
        tx: any,
        userId: string,
        assetTypeId: string
    ) {
        return await tx.wallet.upsert({
            where: {
                userId_assetTypeId: {
                    userId,
                    assetTypeId,
                },
            },
            update: {},
            create: {
                userId,
                assetTypeId,
                balance: 0,
            },
        });
    }

    /**
     * Find multiple wallets by their IDs within a transaction.
     * Fetches wallets in sorted order (by ID) to prevent deadlocks.
     * With Serializable isolation level, Prisma handles row-level locking automatically.
     *
     * @param {Object} tx - The Prisma transaction client
     * @param {string[]} walletIds - Array of wallet unique identifiers
     * @returns {Promise<Array>} An array of wallet objects, sorted by ID
     * @example
     * await prisma.$transaction(async (tx) => {
     *   const wallets = await walletDb.findManyByIds(tx, [walletId1, walletId2]);
     *   // Wallets are fetched in sorted order to prevent deadlocks
     * });
     */
    async findManyByIds(tx: any, walletIds: string[]) {
        const sortedIds = [...walletIds].sort();
        if (sortedIds.length === 0) return [];

        return await tx.wallet.findMany({
            where: {
                id: {
                    in: sortedIds,
                },
            },
            orderBy: {
                id: "asc",
            },
        });
    }

    /**
     * Find a wallet by ID within a database transaction.
     *
     * @param {Object} tx - The Prisma transaction client
     * @param {string} id - The unique identifier of the wallet
     * @returns {Promise<Object|null>} The wallet object if found, null otherwise
     * @example
     * await prisma.$transaction(async (tx) => {
     *   const wallet = await walletDb.findByIdInTransaction(tx, walletId);
     * });
     */
    async findByIdInTransaction(tx: any, id: string) {
        return await tx.wallet.findUnique({
            where: { id },
        });
    }

    /**
     * Increment wallet balance atomically within a transaction.
     * This operation is atomic and thread-safe when used within a Serializable transaction.
     *
     * @param {Object} tx - The Prisma transaction client
     * @param {string} walletId - The unique identifier of the wallet
     * @param {number} amount - The amount to increment (must be positive)
     * @returns {Promise<Object>} The updated wallet object
     * @throws {Error} If wallet is not found
     * @example
     * await prisma.$transaction(async (tx) => {
     *   await walletDb.incrementBalance(tx, walletId, 100);
     * });
     */
    async incrementBalance(tx: any, walletId: string, amount: number) {
        return await tx.wallet.update({
            where: { id: walletId },
            data: {
                balance: {
                    increment: amount,
                },
            },
        });
    }

    /**
     * Decrement wallet balance atomically within a transaction.
     * This operation is atomic and thread-safe when used within a Serializable transaction.
     * Note: This method does not check for negative balance. Use decrementBalanceWithCheck for validation.
     *
     * @param {Object} tx - The Prisma transaction client
     * @param {string} walletId - The unique identifier of the wallet
     * @param {number} amount - The amount to decrement (must be positive)
     * @returns {Promise<Object>} The updated wallet object
     * @throws {Error} If wallet is not found
     * @example
     * await prisma.$transaction(async (tx) => {
     *   await walletDb.decrementBalance(tx, walletId, 50);
     * });
     */
    async decrementBalance(tx: any, walletId: string, amount: number) {
        return await tx.wallet.update({
            where: { id: walletId },
            data: {
                balance: {
                    decrement: amount,
                },
            },
        });
    }

    /**
     * Decrement wallet balance with balance validation (atomic operation).
     * Ensures the balance does not go negative. Throws an error if insufficient balance.
     *
     * @param {Object} tx - The Prisma transaction client
     * @param {string} walletId - The unique identifier of the wallet
     * @param {number} amount - The amount to decrement (must be positive)
     * @returns {Promise<Object>} The updated wallet object
     * @throws {Error} If wallet is not found or if balance would go negative
     * @example
     * await prisma.$transaction(async (tx) => {
     *   try {
     *     await walletDb.decrementBalanceWithCheck(tx, walletId, 100);
     *   } catch (error) {
     *     if (error.message === 'Insufficient balance') {
     *       // Handle insufficient balance
     *     }
     *   }
     * });
     */
    async decrementBalanceWithCheck(
        tx: any,
        walletId: string,
        amount: number
    ) {
        const wallet = await tx.wallet.findUnique({
            where: { id: walletId },
        });

        if (!wallet) {
            throw new Error("Wallet not found");
        }

        const currentBalance = Number(wallet.balance);
        if (currentBalance < amount) {
            throw new Error("Insufficient balance");
        }

        return await tx.wallet.update({
            where: { id: walletId },
            data: {
                balance: {
                    decrement: amount,
                },
            },
        });
    }

    /**
     * Get all wallet IDs for a specific user.
     * Used primarily for querying transaction history.
     *
     * @param {string} userId - The unique identifier of the user
     * @returns {Promise<string[]>} An array of wallet IDs
     * @example
     * const walletIds = await walletDb.getWalletIdsByUserId(userId);
     * // Returns: ['wallet-id-1', 'wallet-id-2', 'wallet-id-3']
     */
    async getWalletIdsByUserId(userId: string) {
        const wallets = await prisma.wallet.findMany({
            where: { userId },
            select: { id: true },
        });
        return wallets.map((w) => w.id);
    }
}
