ALTER TABLE "Project" ADD COLUMN "accessCodeHash" TEXT;
ALTER TABLE "Project" ADD COLUMN "accessVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Project_accessCodeHash_key" ON "Project"("accessCodeHash");
ALTER TABLE "Issue" ADD COLUMN "deletedAt" DATETIME;
CREATE TABLE "LoginThrottle" ("id" TEXT NOT NULL PRIMARY KEY, "windowStart" BIGINT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0);
