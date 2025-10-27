            // Update the dream in the database with the full results
            if (!n8nStreamErrored) {
                try {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            interpretation: fullInterpretation,
                            status: 'completed'
                        }
                    });
                    console.log(`Dream ${dreamId} updated with analysis results.`);
                } catch (dbError) {
                    console.error(`Failed to update dream ${dreamId} in DB after analysis:`, dbError);
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: { status: 'analysis_failed' }
                    }).catch(e => console.error(`Failed to set dream ${dreamId} status to analysis_failed:`, e));
                }
            }
