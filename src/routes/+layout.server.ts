import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // In a real application, you would load user data here
  // For now, we'll return a placeholder user ID
  // This will be used by the layout to determine if a user is "logged in"
  // and can access dream-related features.
  return {
    user: {
      id: 'user-id-placeholder', // Replace with actual user ID from session/token
      name: 'Dreamer'
    }
  };
};
