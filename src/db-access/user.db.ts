import prisma from "../config/database";

/**
 * Database access layer for User operations.
 * Provides atomic database operations for user-related queries.
 *
 * @class UserDbAccess
 */
export class UserDbAccess {
    /**
     * Find a user by their email address.
     *
     * @param {string} email - The email address of the user to find
     * @returns {Promise<Object|null>} The user object if found, null otherwise
     * @example
     * const user = await userDb.findByEmail('user@example.com');
     */
    async findByEmail(email: string) {
        return await prisma.user.findUnique({
            where: { email },
        });
    }

    /**
     * Find a user by their unique identifier.
     *
     * @param {string} id - The unique identifier (UUID) of the user
     * @returns {Promise<Object|null>} The user object if found, null otherwise
     * @example
     * const user = await userDb.findById('123e4567-e89b-12d3-a456-426614174000');
     */
    async findById(id: string) {
        return await prisma.user.findUnique({
            where: { id },
        });
    }

    /**
     * Find the system Treasury user account.
     * The Treasury account is used as the source/destination for funds in the wallet system.
     *
     * @returns {Promise<Object|null>} The Treasury user object if found, null otherwise
     * @throws {Error} If Treasury account is not found (should be seeded during setup)
     * @example
     * const treasury = await userDb.findTreasuryUser();
     * if (!treasury) {
     *   throw new Error('Treasury account not configured');
     * }
     */
    async findTreasuryUser() {
        return await prisma.user.findUnique({
            where: { email: "treasury@wallet.internal" },
        });
    }

    async findAllUsers() {
        return await prisma.user.findMany({
            select:{
                id: true,
                name: true,
                email: true,
            }
        });
    }
}
