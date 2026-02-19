import express, { Request, Response } from "express";
import { WalletService } from "../services/wallet.service";
import { TransactionService } from "../services/transaction.service";
import { UserService } from "../services/user.service";

const router = express.Router();
const userService = new UserService();
const walletService = new WalletService();
const transactionService = new TransactionService();

/**
 * @route GET /api/users
 * @description Get a list of all users
 * @returns {Object} 200 - Success response with all users information
 * @returns {Object} 400 - Error message
 * @example
 * GET /api/users
 * Response: {
 *  "success":true,
 *  "data":[
 *      {
 *          "id":"095c343b-c72a-40c6-a497-aa5c5c879c59",
 *          "name":"System Treasury",
 *          "email":"treasury@wallet.internal"
 *      },
 *  ]
 * }
 */
router.get('/users',async (req:Request, res:Response)=>{
    try{
        const users = await userService.getAllUsers();
        res.json({
            success: true,
            data: users
        });
    }
    catch(error:any){
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * @route GET /api/wallets/:walletId/balance
 * @description Get balance for a specific wallet by wallet ID
 * @param {string} walletId - The unique identifier (UUID) of the wallet
 * @returns {Object} 200 - Success response with wallet balance information
 * @returns {Object} 400 - Error response if wallet is not found
 * @example
 * GET /api/wallets/123e4567-e89b-12d3-a456-426614174000/balance
 * Response: {
 *   "success": true,
 *   "data": {
 *     "walletId": "123e4567-e89b-12d3-a456-426614174000",
 *     "userId": "user-123",
 *     "assetType": "GOLD",
 *     "balance": "100.000000"
 *   }
 * }
 */
router.get("/wallets/:walletId/balance", async (req: Request, res: Response) => {
    try {
        const { walletId } = req.params;

        const wallet = await walletService.getWalletById(walletId as string);

        res.json({
            success: true,
            data: {
                walletId: wallet.id,
                userId: wallet.userId,
                assetType: wallet.assetType.name,
                balance: wallet.balance.toString(),
            },
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * @route GET /api/wallets/:userId/balance/:assetType
 * @description Get balance for a specific user and asset type. Creates wallet if it doesn't exist.
 * @param {string} userId - The unique identifier of the user
 * @param {string} assetType - The name of the asset type (e.g., 'GOLD', 'DIAMOND', 'LOYALTY_POINTS')
 * @returns {Object} 200 - Success response with wallet balance information
 * @returns {Object} 400 - Error response if asset type is not found
 * @example
 * GET /api/wallets/user-123/balance/GOLD
 * Response: {
 *   "success": true,
 *   "data": {
 *     "userId": "user-123",
 *     "assetType": "GOLD",
 *     "balance": "100.000000"
 *   }
 * }
 */
router.get(
    "/wallets/:userId/balance/:assetType",
    async (req: Request, res: Response) => {
        try {
            const { userId, assetType } = req.params;

            const wallet = await walletService.getBalance(userId as string, assetType as string);

            res.json({
                success: true,
                data: {
                    userId,
                    assetType: wallet.assetType.name,
                    balance: wallet.balance.toString(),
                },
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/**
 * @route GET /api/wallets/:userId
 * @description Get all wallets for a user across all asset types
 * @param {string} userId - The unique identifier of the user
 * @returns {Object} 200 - Success response with array of wallets
 * @example
 * GET /api/wallets/user-123
 * Response: {
 *   "success": true,
 *   "data": [
 *     { "id": "wallet-1", "assetType": "GOLD", "balance": "100.000000" },
 *     { "id": "wallet-2", "assetType": "DIAMOND", "balance": "50.000000" },
 *     { "id": "wallet-3", "assetType": "LOYALTY_POINTS", "balance": "200.000000" }
 *   ]
 * }
 */
router.get("/wallets/:userId", async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const wallets = await walletService.getUserWallets(userId as string);

        res.json({
            success: true,
            data: wallets.map((w) => ({
                id: w.id,
                assetType: w.assetType.name,
                balance: w.balance.toString(),
            })),
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * @route POST /api/transactions/top-up
 * @description Wallet Top-up: User purchases credits using real money. Credits user's wallet from Treasury.
 * @body {string} userId - The unique identifier of the user
 * @body {string} assetType - The name of the asset type (e.g., 'GOLD', 'DIAMOND', 'LOYALTY_POINTS')
 * @body {number} amount - The amount to credit (must be positive)
 * @body {string} [idempotencyKey] - Optional unique key to prevent duplicate transactions
 * @returns {Object} 201 - Success response with transaction details
 * @returns {Object} 400 - Error response if validation fails or transaction fails
 * @example
 * POST /api/transactions/top-up
 * Body: {
 *   "userId": "user-123",
 *   "assetType": "GOLD",
 *   "amount": 100,
 *   "idempotencyKey": "unique-key-123"
 * }
 * Response: {
 *   "success": true,
 *   "data": {
 *     "transactionId": "txn-123",
 *     "userId": "user-123",
 *     "assetType": "GOLD",
 *     "amount": "100.000000",
 *     "status": "COMPLETED",
 *     "createdAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.post("/transactions/top-up", async (req: Request, res: Response) => {
    try {
        const { userId, assetType, amount, idempotencyKey } = req.body;

        if (!userId || !assetType || amount === undefined) {
            return res.status(400).json({
                success: false,
                error: "userId, assetType, and amount are required",
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: "Amount must be greater than 0",
            });
        }

        const transaction = await transactionService.topUp(
            userId,
            assetType,
            amount,
            idempotencyKey
        );

        res.status(201).json({
            success: true,
            data: {
                transactionId: transaction.id,
                userId,
                assetType,
                amount: transaction.amount.toString(),
                status: transaction.status,
                createdAt: transaction.createdAt,
            },
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * @route POST /api/transactions/bonus
 * @description Bonus/Incentive: System issues free credits to a user. Credits user's wallet from Treasury.
 * @body {string} userId - The unique identifier of the user
 * @body {string} assetType - The name of the asset type (e.g., 'GOLD', 'DIAMOND', 'LOYALTY_POINTS')
 * @body {number} amount - The amount to credit (must be positive)
 * @body {string} [description] - Optional description of the bonus (e.g., 'Referral bonus')
 * @body {string} [idempotencyKey] - Optional unique key to prevent duplicate transactions
 * @returns {Object} 201 - Success response with transaction details
 * @returns {Object} 400 - Error response if validation fails or transaction fails
 * @example
 * POST /api/transactions/bonus
 * Body: {
 *   "userId": "user-123",
 *   "assetType": "LOYALTY_POINTS",
 *   "amount": 500,
 *   "description": "Referral bonus for inviting a friend",
 *   "idempotencyKey": "bonus-key-123"
 * }
 * Response: {
 *   "success": true,
 *   "data": {
 *     "transactionId": "txn-456",
 *     "userId": "user-123",
 *     "assetType": "LOYALTY_POINTS",
 *     "amount": "500.000000",
 *     "description": "Referral bonus for inviting a friend",
 *     "status": "COMPLETED",
 *     "createdAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.post("/transactions/bonus", async (req: Request, res: Response) => {
    try {
        const {
            userId,
            assetType,
            amount,
            description,
            idempotencyKey,
        } = req.body;

        if (!userId || !assetType || amount === undefined) {
            return res.status(400).json({
                success: false,
                error: "userId, assetType, and amount are required",
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: "Amount must be greater than 0",
            });
        }

        const transaction = await transactionService.issueBonus(
            userId,
            assetType,
            amount,
            description,
            idempotencyKey
        );

        res.status(201).json({
            success: true,
            data: {
                transactionId: transaction.id,
                userId,
                assetType,
                amount: transaction.amount.toString(),
                description: transaction.description,
                status: transaction.status,
                createdAt: transaction.createdAt,
            },
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * @route POST /api/transactions/spend
 * @description Purchase/Spend: User spends credits to buy a service. Debits user's wallet and credits Treasury.
 * @body {string} userId - The unique identifier of the user
 * @body {string} assetType - The name of the asset type (e.g., 'GOLD', 'DIAMOND', 'LOYALTY_POINTS')
 * @body {number} amount - The amount to spend (must be positive)
 * @body {string} description - Description of the purchase (e.g., 'In-game item purchase')
 * @body {string} [idempotencyKey] - Optional unique key to prevent duplicate transactions
 * @returns {Object} 201 - Success response with transaction details
 * @returns {Object} 400 - Error response if validation fails, insufficient balance, or transaction fails
 * @example
 * POST /api/transactions/spend
 * Body: {
 *   "userId": "user-123",
 *   "assetType": "GOLD",
 *   "amount": 50,
 *   "description": "Purchased premium sword",
 *   "idempotencyKey": "purchase-key-123"
 * }
 * Response: {
 *   "success": true,
 *   "data": {
 *     "transactionId": "txn-789",
 *     "userId": "user-123",
 *     "assetType": "GOLD",
 *     "amount": "50.000000",
 *     "description": "Purchased premium sword",
 *     "status": "COMPLETED",
 *     "createdAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.post("/transactions/spend", async (req: Request, res: Response) => {
    try {
        const { userId, assetType, amount, description, idempotencyKey } =
            req.body;

        if (!userId || !assetType || amount === undefined || !description) {
            return res.status(400).json({
                success: false,
                error: "userId, assetType, amount, and description are required",
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: "Amount must be greater than 0",
            });
        }

        const transaction = await transactionService.spend(
            userId,
            assetType,
            amount,
            description,
            idempotencyKey
        );

        res.status(201).json({
            success: true,
            data: {
                transactionId: transaction.id,
                userId,
                assetType,
                amount: transaction.amount.toString(),
                description: transaction.description,
                status: transaction.status,
                createdAt: transaction.createdAt,
            },
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * @route GET /api/transactions/:userId/history
 * @description Get transaction history for a user. Returns all transactions where user's wallets were involved.
 * @param {string} userId - The unique identifier of the user
 * @query {number} [limit=50] - Maximum number of transactions to return (default: 50)
 * @returns {Object} 200 - Success response with array of transactions
 * @example
 * GET /api/transactions/user-123/history?limit=100
 * Response: {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "txn-1",
 *       "type": "DEPOSIT",
 *       "status": "COMPLETED",
 *       "amount": "100.000000",
 *       "description": "Top-up: 100 GOLD",
 *       "sender": { "userId": "treasury", "assetType": "GOLD" },
 *       "receiver": { "userId": "user-123", "assetType": "GOLD" },
 *       "createdAt": "2024-01-01T00:00:00.000Z"
 *     }
 *   ]
 * }
 */
router.get(
    "/transactions/:userId/history",
    async (req: Request, res: Response) => {
        try {
            const { userId } = req.params;
            const limit = parseInt(req.query.limit as string) || 50;
            const skip = parseInt(req.query.skip as string) || 0;

            const transactions = await transactionService.getTransactionHistory(
                userId as string,
                limit,
                skip,
            );

            res.json({
                success: true,
                data: transactions.map((t) => ({
                    id: t.id,
                    type: t.type,
                    status: t.status,
                    amount: t.amount.toString(),
                    description: t.description,
                    sender: t.senderWallet
                        ? {
                              userId: t.senderWallet.userId,
                              assetType: t.senderWallet.assetType.name,
                          }
                        : null,
                    receiver: t.receiverWallet
                        ? {
                              userId: t.receiverWallet.userId,
                              assetType: t.receiverWallet.assetType.name,
                          }
                        : null,
                    createdAt: t.createdAt,
                })),
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
);

export default router;
