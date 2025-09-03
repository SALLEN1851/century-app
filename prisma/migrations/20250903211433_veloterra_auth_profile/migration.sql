-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "public"."UnitSystem" AS ENUM ('imperial', 'metric');

-- CreateEnum
CREATE TYPE "public"."RiderType" AS ENUM ('Gravel', 'Road', 'MTB', 'CX', 'TT', 'Multi');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "passwordHash" TEXT,
    "unitSystem" "public"."UnitSystem" NOT NULL DEFAULT 'imperial',
    "ftp" INTEGER,
    "riderType" "public"."RiderType",
    "weightLbs" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."WhoopCycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "whoopId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WhoopRecovery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "whoopId" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WhoopSleep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "whoopId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopSleep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WhoopWorkout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "whoopId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "sport" TEXT,
    "strain" DOUBLE PRECISION,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "public"."Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "WhoopCycle_whoopId_key" ON "public"."WhoopCycle"("whoopId");

-- CreateIndex
CREATE INDEX "WhoopCycle_userId_startedAt_idx" ON "public"."WhoopCycle"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "WhoopCycle_userId_idx" ON "public"."WhoopCycle"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhoopRecovery_whoopId_key" ON "public"."WhoopRecovery"("whoopId");

-- CreateIndex
CREATE INDEX "WhoopRecovery_userId_recordedAt_idx" ON "public"."WhoopRecovery"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "WhoopRecovery_userId_idx" ON "public"."WhoopRecovery"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhoopSleep_whoopId_key" ON "public"."WhoopSleep"("whoopId");

-- CreateIndex
CREATE INDEX "WhoopSleep_userId_startedAt_idx" ON "public"."WhoopSleep"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "WhoopSleep_userId_idx" ON "public"."WhoopSleep"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhoopWorkout_whoopId_key" ON "public"."WhoopWorkout"("whoopId");

-- CreateIndex
CREATE INDEX "WhoopWorkout_userId_startedAt_idx" ON "public"."WhoopWorkout"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "WhoopWorkout_userId_idx" ON "public"."WhoopWorkout"("userId");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WhoopCycle" ADD CONSTRAINT "WhoopCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WhoopRecovery" ADD CONSTRAINT "WhoopRecovery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WhoopSleep" ADD CONSTRAINT "WhoopSleep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WhoopWorkout" ADD CONSTRAINT "WhoopWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
