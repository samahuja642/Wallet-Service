import prisma from "../config/database";

/**
 * Database access layer for AssetType operations.
 * Provides atomic database operations for asset type-related queries.
 *
 * @class AssetTypeDbAccess
 */
export class AssetTypeDbAccess {
    /**
     * Find an asset type by its name.
     *
     * @param {string} name - The name of the asset type (e.g., 'GOLD', 'DIAMOND', 'LOYALTY_POINTS')
     * @returns {Promise<Object|null>} The asset type object if found, null otherwise
     * @example
     * const assetType = await assetTypeDb.findByName('GOLD');
     */
    async findByName(name: string) {
        return await prisma.assetType.findUnique({
            where: { name },
        });
    }

    /**
     * Find an asset type by its unique identifier.
     *
     * @param {string} id - The unique identifier (UUID) of the asset type
     * @returns {Promise<Object|null>} The asset type object if found, null otherwise
     * @example
     * const assetType = await assetTypeDb.findById('123e4567-e89b-12d3-a456-426614174000');
     */
    async findById(id: string) {
        return await prisma.assetType.findUnique({
            where: { id },
        });
    }

    /**
     * Retrieve all asset types from the database.
     *
     * @returns {Promise<Array>} An array of all asset type objects
     * @example
     * const assetTypes = await assetTypeDb.findAll();
     * // Returns: [{ id: '...', name: 'GOLD', ... }, { id: '...', name: 'DIAMOND', ... }]
     */
    async findAll() {
        return await prisma.assetType.findMany();
    }
}
