-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "audioDuration" INTEGER,
ADD COLUMN     "audioFileSize" INTEGER,
ADD COLUMN     "audioFormat" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "audioDuration" INTEGER,
ADD COLUMN     "audioFileSize" INTEGER,
ADD COLUMN     "audioFormat" TEXT;
