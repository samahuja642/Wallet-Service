import { WalletDbAccess } from "../db-access/wallet.db";
import { AssetTypeDbAccess } from "../db-access/asset-type.db";

/**
 * Service layer for wallet operations.
 * Provides business logic for wallet-related operations, delegating database access to the db-access layer.
 *
 * @class WalletService
 */
export class WalletService {
    private walletDb: WalletDbAccess;
    private assetTypeDb: AssetTypeDbAccess;

    /**
     * Creates an instance of WalletService.
     * Initializes the database access layer dependencies.
     */
    constructor() {
        this.walletDb = new WalletDbAccess();
        this.assetTypeDb = new AssetTypeDbAccess();
    }

    /**
     * Get wallet balance for a user and asset type.
     * If the wallet doesn't exist, it will be created automatically with a balance of 0.
     *
     * @param {string} userId - The unique identifier of the user
     * @param {string} assetTypeName - The name of the asset type (e.g., 'GOLD', 'DIAMOND', 'LOYALTY_POINTS')
     * @returns {Promise<Object>} The wallet object with balance and related assetType information
     * @throws {Error} If the asset type is not found
     * @example
     * const wallet = await walletService.getBalance('user-123', 'GOLD');
     * console.log(wallet.balance); // Current balance
     */
    async getBalance(userId: string, assetTypeName: string) {
        const assetType = await this.assetTypeDb.findByName(assetTypeName);

        if (!assetType) {
            throw new Error(`Asset type ${assetTypeName} not found`);
        }

        const wallet = await this.walletDb.findByUserAndAssetType(
            userId,
            assetType.id
        );

        if (!wallet) {
            // Create wallet if it doesn't exist
            return await this.walletDb.getOrCreate(userId, assetType.id);
        }

        return wallet;
    }

    /**
     * Get wallet by its unique identifier.
     *
     * @param {string} walletId - The unique identifier (UUID) of the wallet
     * @returns {Promise<Object>} The wallet object with balance and related information
     * @throws {Error} If the wallet is not found
     * @example
     * const wallet = await walletService.getWalletById('wallet-123');
     */
    async getWalletById(walletId: string) {
        const wallet = await this.walletDb.findById(walletId);

        if (!wallet) {
            throw new Error(`Wallet with ID ${walletId} not found`);
        }

        return wallet;
    }

    /**
     * Get all wallets for a specific user.
     * Returns all wallets (for all asset types) associated with the user.
     *
     * @param {string} userId - The unique identifier of the user
     * @returns {Promise<Array>} An array of wallet objects with balance and assetType information
     * @example
     * const wallets = await walletService.getUserWallets('user-123');
     * // Returns: [{ assetType: 'GOLD', balance: 100 }, { assetType: 'DIAMOND', balance: 50 }, ...]
     */
    async getUserWallets(userId: string) {
        return await this.walletDb.findByUserId(userId);
    }

    /**
     * Get or create a wallet for a user and asset type.
     * If the wallet exists, returns it. If not, creates a new wallet with balance 0.
     *
     * @param {string} userId - The unique identifier of the user
     * @param {string} assetTypeId - The unique identifier of the asset type
     * @returns {Promise<Object>} The wallet object
     * @example
     * const wallet = await walletService.getOrCreateWallet(userId, assetTypeId);
     */
    async getOrCreateWallet(userId: string, assetTypeId: string) {
        return await this.walletDb.getOrCreate(userId, assetTypeId);
    }
}
