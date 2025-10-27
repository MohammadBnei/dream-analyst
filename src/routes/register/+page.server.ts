import { fail, redirect, type Actions } from '@sveltejs/kit';
import { createUser } from '$lib/server/userService';
import { generateToken, setAuthTokenCookie } from '$lib/server/auth';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username')?.toString();
    const email = data.get('email')?.toString(); // Get email from form data
    const password = data.get('password')?.toString();

    if (!username || !password) {
      return fail(400, {
        message: 'Missing username or password',
        username,
        email, // Pass email back to the form if available
      });
    }

    try {
      const userId = await createUser(username, email, password); // Pass email to createUser
      const token = generateToken(userId, username, email); // Include email in token generation
      setAuthTokenCookie(cookies, token);
    } catch (error) {
      console.error('Registration error:', error);
      return fail(500, {
        message: 'Could not register user. Please try again.',
        username,
        email, // Pass email back to the form if available
      });
    }

    throw redirect(303, '/'); // Redirect to home page after successful registration
  },
};
