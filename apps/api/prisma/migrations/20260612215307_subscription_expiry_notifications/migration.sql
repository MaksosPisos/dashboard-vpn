-- CreateTable
CREATE TABLE "SubscriptionExpiryNotification" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionExpiryNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionExpiryNotification_subscriptionId_idx" ON "SubscriptionExpiryNotification"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionExpiryNotification_subscriptionId_daysBefore_key" ON "SubscriptionExpiryNotification"("subscriptionId", "daysBefore");

-- AddForeignKey
ALTER TABLE "SubscriptionExpiryNotification" ADD CONSTRAINT "SubscriptionExpiryNotification_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
