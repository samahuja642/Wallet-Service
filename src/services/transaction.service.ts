import prisma from "../config/database";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { WalletService } from "./wallet.service";
import { WalletDbAccess } from "../db-access/wallet.db";
import { TransactionDbAccess } from "../db-access/transaction.db";
import { AssetTypeDbAccess } from "../db-access/asset-type.db";
import { UserDbAccess } from "../db-access/user.db";

/**
 * Service layer for transaction operations.
 * Provides business logic for wallet transactions including top-up, bonus issuance, and spending.
 * All operations use database transactions with Serializable isolation level to ensure atomicity and prevent race conditions.
 *
 * @class TransactionService
 */
export class TransactionService {
    private walletService: WalletService;
    private walletDb: WalletDbAccess;
    private transactionDb: TransactionDbAccess;
    private assetTypeDb: AssetTypeDbAccess;
    private userDb: UserDbAccess;

    /**
     * Creates an instance of TransactionService.
     * Initializes all required database access layer dependencies.
     */
    constructor() {
        this.walletService = new WalletService();
        this.walletDb = new WalletDbAccess();
        this.transactionDb = new TransactionDbAccess();
        this.assetTypeDb = new AssetTypeDbAccess();
        this.userDb = new UserDbAccess();
    }

    /**
     * Wallet Top-up (Purchase): User purchases credits using real money.
     * Credits the user's wallet from the Treasury account.
     * This operation is atomic and supports idempotency to prevent duplicate transactions.
     *
     * @param {string} userId - The unique identifier of the user receiving the credits
     * @param {string} assetTypeName - The name of the asset type (e.g., 'GOLD', 'DIAMOND', 'LOYALTY_POINTS')
     * @param {number} amount - The amount to credit (must be positive)
     * @param {string} [idempotencyKey] - Optional unique key to prevent duplicate transactions
     * @returns {Promise<Object>} The completed transaction object
     * @throws {Error} If asset type is not found
     * @throws {Error} If Treasury account is not found
     * @throws {Error} If Treasury has insufficient balance
     * @example
     * const transaction = await transactionService.topUp(
     *   'user-123',
     *   'GOLD',
     *   100,
     *   'unique-key-123'
     * );
     */
    async topUp(
        userId: string,
        assetTypeName: string,
        amount: number,
        idempotencyKey?: string
    ) {
        // Check idempotency if key provided
        if (idempotencyKey) {
            const existing = await this.transactionDb.findByIdempotencyKey(
                idempotencyKey
            );
            if (existing) {
                throw new Error(`Idempotency Key Already Exists`);
            }
        }

        const assetType = await this.assetTypeDb.findByName(assetTypeName);
        if (!assetType) {
            throw new Error(`Asset type ${assetTypeName} not found`);
        }

        const treasuryUser = await this.userDb.findTreasuryUser();
        if (!treasuryUser) {
            throw new Error("Treasury account not found");
        }

        // Get or create wallets
        const treasuryWallet = await this.walletService.getOrCreateWallet(
            treasuryUser.id,
            assetType.id
        );
        const userWallet = await this.walletService.getOrCreateWallet(
            userId,
            assetType.id
        );

        // Use database transaction - all operations are atomic
        return await prisma.$transaction(
            async (tx) => {
                // Fetch wallets in sorted order to prevent deadlocks
                const walletIds = [treasuryWallet.id, userWallet.id].sort();
                const wallets = await this.walletDb.findManyByIds(tx, walletIds);

                const lockedTreasuryWallet = wallets.find(
                    (w:any) => w.id === treasuryWallet.id
                );
                const lockedUserWallet = wallets.find(
                    (w:any) => w.id === userWallet.id
                );

                if (!lockedTreasuryWallet || !lockedUserWallet) {
                    throw new Error("Wallet not found");
                }

                // Check treasury has sufficient balance
                const treasuryBalance = Number(lockedTreasuryWallet.balance);
                if (treasuryBalance < amount) {
                    throw new Error("Insufficient treasury balance");
                }

                // Create transaction record
                const transaction = await this.transactionDb.create(tx, {
                    senderWalletId: treasuryWallet.id,
                    receiverWalletId: userWallet.id,
                    amount: amount,
                    type: TransactionType.DEPOSIT,
                    description: `Top-up: ${amount} ${assetTypeName}`,
                    metadata: idempotencyKey
                        ? { idempotencyKey }
                        : undefined,
                });

                // Update balances atomically (all within same transaction)
                await this.walletDb.decrementBalance(
                    tx,
                    treasuryWallet.id,
                    amount
                );
                await this.walletDb.incrementBalance(tx, userWallet.id, amount);

                // Mark transaction as completed
                return await this.transactionDb.updateStatus(
                    tx,
                    transaction.id,
                    TransactionStatus.COMPLETED
                );
            },
            {
                isolationLevel: "Serializable",
            }
        );
    }

    /**
     * Bonus/Incentive: System issues free credits to a user.
     * Credits the user's wallet from the Treasury account (e.g., referral bonus, promotional credits).
     * This operation is atomic and supports idempotency to prevent duplicate transactions.
     *
     * @param {string} userId - The unique identifier of the user receiving the bonus
     * @param {string} assetTypeName - The name of the asset type (e.g., 'GOLD', 'DIAMOND', 'LOYALTY_POINTS')
     * @param {number} amount - The amount to credit (must be positive)
     * @param {string} description - Description of the bonus (e.g., 'Referral bonus', 'Welcome bonus')
     * @param {string} [idempotencyKey] - Optional unique key to prevent duplicate transactions
     * @returns {Promise<Object>} The completed transaction object
     * @throws {Error} If asset type is not found
     * @throws {Error} If Treasury account is not found
     * @throws {Error} If Treasury has insufficient balance
     * @example
     * const transaction = await transactionService.issueBonus(
     *   'user-123',
     *   'LOYALTY_POINTS',
     *   500,
     *   'Referral bonus for inviting a friend',
     *   'bonus-key-123'
     * );
     */
    async issueBonus(
        userId: string,
        assetTypeName: string,
        amount: number,
        description: string,
        idempotencyKey?: string
    ) {
        // Check idempotency if key provided
        if (idempotencyKey) {
            const existing = await this.transactionDb.findByIdempotencyKey(
                idempotencyKey
            );
            if (existing) {
                return existing;
            }
        }

        const assetType = await this.assetTypeDb.findByName(assetTypeName);
        if (!assetType) {
            throw new Error(`Asset type ${assetTypeName} not found`);
        }

        const treasuryUser = await this.userDb.findTreasuryUser();
        if (!treasuryUser) {
            throw new Error("Treasury account not found");
        }

        const treasuryWallet = await this.walletService.getOrCreateWallet(
            treasuryUser.id,
            assetType.id
        );
        const userWallet = await this.walletService.getOrCreateWallet(
            userId,
            assetType.id
        );

        // Use database transaction - all operations are atomic
        return await prisma.$transaction(
            async (tx) => {
                // Fetch wallets in sorted order to prevent deadlocks
                const walletIds = [treasuryWallet.id, userWallet.id].sort();
                const wallets = await this.walletDb.findManyByIds(tx, walletIds);

                const lockedTreasuryWallet = wallets.find(
                    (w:any) => w.id === treasuryWallet.id
                );
                const lockedUserWallet = wallets.find(
                    (w:any) => w.id === userWallet.id
                );

                if (!lockedTreasuryWallet || !lockedUserWallet) {
                    throw new Error("Wallet not found");
                }

                const treasuryBalance = Number(lockedTreasuryWallet.balance);
                if (treasuryBalance < amount) {
                    throw new Error("Insufficient treasury balance");
                }

                const transaction = await this.transactionDb.create(tx, {
                    senderWalletId: treasuryWallet.id,
                    receiverWalletId: userWallet.id,
                    amount: amount,
                    type: TransactionType.DEPOSIT,
                    description: description || `Bonus: ${amount} ${assetTypeName}`,
                    metadata: idempotencyKey
                        ? { idempotencyKey }
                        : undefined,
                });

                // Update balances atomically (all within same transaction)
                await this.walletDb.decrementBalance(
                    tx,
                    treasuryWallet.id,
                    amount
                );
                await this.walletDb.incrementBalance(tx, userWallet.id, amount);

                return await this.transactionDb.updateStatus(
                    tx,
                    transaction.id,
                    TransactionStatus.COMPLETED
                );
            },
            {
                isolationLevel: "Serializable",
            }
        );
    }

    /**
     * Purchase/Spend: User spends credits to buy a service within the app.
     * Debits the user's wallet and credits the Treasury account (revenue).
     * This operation is atomic and supports idempotency to prevent duplicate transactions.
     *
     * @param {string} userId - The unique identifier of the user making the purchase
     * @param {string} assetTypeName - The name of the asset type (e.g., 'GOLD', 'DIAMOND', 'LOYALTY_POINTS')
     * @param {number} amount - The amount to spend (must be positive)
     * @param {string} description - Description of the purchase (e.g., 'In-game item purchase')
     * @param {string} [idempotencyKey] - Optional unique key to prevent duplicate transactions
     * @returns {Promise<Object>} The completed transaction object
     * @throws {Error} If asset type is not found
     * @throws {Error} If Treasury account is not found
     * @throws {Error} If user has insufficient balance
     * @example
     * const transaction = await transactionService.spend(
     *   'user-123',
     *   'GOLD',
     *   50,
     *   'Purchased premium sword',
     *   'purchase-key-123'
     * );
     */
    async spend(
        userId: string,
        assetTypeName: string,
        amount: number,
        description: string,
        idempotencyKey?: string
    ) {
        // Check idempotency if key provided
        if (idempotencyKey) {
            const existing = await this.transactionDb.findByIdempotencyKey(
                idempotencyKey
            );
            if (existing) {
                return existing;
            }
        }

        const assetType = await this.assetTypeDb.findByName(assetTypeName);
        if (!assetType) {
            throw new Error(`Asset type ${assetTypeName} not found`);
        }

        const treasuryUser = await this.userDb.findTreasuryUser();
        if (!treasuryUser) {
            throw new Error("Treasury account not found");
        }

        const userWallet = await this.walletService.getOrCreateWallet(
            userId,
            assetType.id
        );
        const treasuryWallet = await this.walletService.getOrCreateWallet(
            treasuryUser.id,
            assetType.id
        );

        // Use database transaction - all operations are atomic
        return await prisma.$transaction(
            async (tx) => {
                // Fetch wallets in sorted order to prevent deadlocks
                const walletIds = [userWallet.id, treasuryWallet.id].sort();
                const wallets = await this.walletDb.findManyByIds(tx, walletIds);

                const lockedUserWallet = wallets.find(
                    (w:any) => w.id === userWallet.id
                );
                const lockedTreasuryWallet = wallets.find(
                    (w:any) => w.id === treasuryWallet.id
                );

                if (!lockedUserWallet || !lockedTreasuryWallet) {
                    throw new Error("Wallet not found");
                }

                // Check user has sufficient balance
                const userBalance = Number(lockedUserWallet.balance);
                if (userBalance < amount) {
                    throw new Error("Insufficient balance");
                }

                // Create transaction record
                const transaction = await this.transactionDb.create(tx, {
                    senderWalletId: userWallet.id,
                    receiverWalletId: treasuryWallet.id,
                    amount: amount,
                    type: TransactionType.WITHDRAWAL,
                    description: description || `Purchase: ${amount} ${assetTypeName}`,
                    metadata: idempotencyKey
                        ? { idempotencyKey }
                        : undefined,
                });

                // Update balances atomically (all within same transaction)
                await this.walletDb.decrementBalance(tx, userWallet.id, amount);
                await this.walletDb.incrementBalance(
                    tx,
                    treasuryWallet.id,
                    amount
                );

                // Mark transaction as completed
                return await this.transactionDb.updateStatus(
                    tx,
                    transaction.id,
                    TransactionStatus.COMPLETED
                );
            },
            {
                isolationLevel: "Serializable",
            }
        );
    }

    /**
     * Get transaction history for a user.
     * Returns all transactions where the user's wallets were involved (as sender or receiver).
     *
     * @param {string} userId - The unique identifier of the user
     * @param {number} [limit=50] - Maximum number of transactions to return
     * @returns {Promise<Array>} An array of transaction objects with related wallet, user, and assetType information
     * @example
     * const transactions = await transactionService.getTransactionHistory('user-123', 100);
     * // Returns transactions ordered by creation date (newest first)
     */
    async getTransactionHistory(userId: string, limit: number = 50, skip: number = 0) {
        const walletIds = await this.walletDb.getWalletIdsByUserId(userId);
        return await this.transactionDb.findByWalletIds(walletIds, limit, skip);
    }
}
