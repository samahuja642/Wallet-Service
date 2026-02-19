import { UserDbAccess } from "../db-access/user.db";

/**
 * Service layer for user operations.
 * Provides business logic for user-related operations, delegating database access to the db-access layer.
 *
 * @class UserService
 */
export class UserService {
    private userDb: UserDbAccess;
    /**
     * Creates an instance of UserService.
     * Initializes the database access layer dependencies.
     */
    constructor(){
        this.userDb = new UserDbAccess();
    }

    /**
     * @returns {Promise<Object[]>}
     */
    async getAllUsers(): Promise<Object[]> {
        const users = await this.userDb.findAllUsers();
        return users;
    }
}