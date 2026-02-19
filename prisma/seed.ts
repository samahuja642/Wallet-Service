import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is required to run the seed. Add it to .env");
}
const prisma = new PrismaClient();

async function main() {
    // 1. Asset Types (application assets: Gold Coins, Diamonds, Loyalty Points)
    console.log("Seeding asset types...");
    const [gold, diamond, loyaltyPoints] = await Promise.all([
        prisma.assetType.upsert({
            where: { name: "GOLD" },
            update: {},
            create: {
                name: "GOLD",
                description: "Gold Coins — in-app currency for purchases",
            },
        }),
        prisma.assetType.upsert({
            where: { name: "DIAMOND" },
            update: {},
            create: {
                name: "DIAMOND",
                description: "Diamonds — premium in-app currency",
            },
        }),
        prisma.assetType.upsert({
            where: { name: "LOYALTY_POINTS" },
            update: {},
            create: {
                name: "LOYALTY_POINTS",
                description: "Loyalty Points — reward points from referrals and activities",
            },
        }),
    ]);
    console.log("✅ Seeded asset types: GOLD, DIAMOND, LOYALTY_POINTS");

    // 2. System account (Treasury / Revenue — source/destination for funds)
    console.log("Seeding system account (Treasury)...");
    const systemUser = await prisma.user.upsert({
        where: { email: "treasury@wallet.internal" },
        update: {},
        create: {
            email: "treasury@wallet.internal",
            name: "System Treasury",
        },
    });

    const treasuryInitialBalance = "1000000"; // Pool for top-ups and bonuses
    await Promise.all([
        prisma.wallet.upsert({
            where: {
                userId_assetTypeId: {
                    userId: systemUser.id,
                    assetTypeId: gold.id,
                },
            },
            update: {},
            create: {
                userId: systemUser.id,
                assetTypeId: gold.id,
                balance: treasuryInitialBalance,
            },
        }),
        prisma.wallet.upsert({
            where: {
                userId_assetTypeId: {
                    userId: systemUser.id,
                    assetTypeId: diamond.id,
                },
            },
            update: {},
            create: {
                userId: systemUser.id,
                assetTypeId: diamond.id,
                balance: treasuryInitialBalance,
            },
        }),
        prisma.wallet.upsert({
            where: {
                userId_assetTypeId: {
                    userId: systemUser.id,
                    assetTypeId: loyaltyPoints.id,
                },
            },
            update: {},
            create: {
                userId: systemUser.id,
                assetTypeId: loyaltyPoints.id,
                balance: treasuryInitialBalance,
            },
        }),
    ]);
    console.log("✅ Seeded system account: Treasury with wallets for all asset types");

    // 3. User accounts (at least two users) with wallets initialized to 0 balance
    console.log("Seeding user accounts...");
    const [alice, bob] = await Promise.all([
        prisma.user.upsert({
            where: { email: "alice@example.com" },
            update: {},
            create: {
                email: "alice@example.com",
                name: "Alice",
            },
        }),
        prisma.user.upsert({
            where: { email: "bob@example.com" },
            update: {},
            create: {
                email: "bob@example.com",
                name: "Bob",
            },
        }),
    ]);

    // Alice: 0 balance for all asset types
    await Promise.all([
        prisma.wallet.upsert({
            where: {
                userId_assetTypeId: { userId: alice.id, assetTypeId: gold.id },
            },
            update: {},
            create: {
                userId: alice.id,
                assetTypeId: gold.id,
                balance: "0",
            },
        }),
        prisma.wallet.upsert({
            where: {
                userId_assetTypeId: { userId: alice.id, assetTypeId: diamond.id },
            },
            update: {},
            create: {
                userId: alice.id,
                assetTypeId: diamond.id,
                balance: "0",
            },
        }),
        prisma.wallet.upsert({
            where: {
                userId_assetTypeId: {
                    userId: alice.id,
                    assetTypeId: loyaltyPoints.id,
                },
            },
            update: {},
            create: {
                userId: alice.id,
                assetTypeId: loyaltyPoints.id,
                balance: "0",
            },
        }),
    ]);

    // Bob: 0 balance for all asset types
    await Promise.all([
        prisma.wallet.upsert({
            where: {
                userId_assetTypeId: { userId: bob.id, assetTypeId: gold.id },
            },
            update: {},
            create: {
                userId: bob.id,
                assetTypeId: gold.id,
                balance: "0",
            },
        }),
        prisma.wallet.upsert({
            where: {
                userId_assetTypeId: { userId: bob.id, assetTypeId: diamond.id },
            },
            update: {},
            create: {
                userId: bob.id,
                assetTypeId: diamond.id,
                balance: "0",
            },
        }),
        prisma.wallet.upsert({
            where: {
                userId_assetTypeId: {
                    userId: bob.id,
                    assetTypeId: loyaltyPoints.id,
                },
            },
            update: {},
            create: {
                userId: bob.id,
                assetTypeId: loyaltyPoints.id,
                balance: "0",
            },
        }),
    ]);
    console.log("✅ Seeded users: Alice and Bob with wallets (balance: 0)");

    console.log("\n🎉 Seed completed successfully.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
