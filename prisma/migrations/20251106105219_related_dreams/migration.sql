-- CreateTable
CREATE TABLE "_RelatedDreams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RelatedDreams_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RelatedDreams_B_index" ON "_RelatedDreams"("B");

-- AddForeignKey
ALTER TABLE "_RelatedDreams" ADD CONSTRAINT "_RelatedDreams_A_fkey" FOREIGN KEY ("A") REFERENCES "dreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedDreams" ADD CONSTRAINT "_RelatedDreams_B_fkey" FOREIGN KEY ("B") REFERENCES "dreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
