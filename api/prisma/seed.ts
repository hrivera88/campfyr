import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {

    //Create
}

main().catch((e) => { 
    process.exit(1);
}).finally(async () => { 
    await prisma.$disconnect();
});