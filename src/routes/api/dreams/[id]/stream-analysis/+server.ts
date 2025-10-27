    // Ensure the dream is in a pending state for analysis
    if (dream.status !== 'pending_analysis') {
        // If analysis is already completed or failed, we might want to just return the stored data
        // or throw an error depending on desired behavior. For now, let's error.
        throw error(409, 'Analysis for this dream is not pending.');
    }
