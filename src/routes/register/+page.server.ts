import { fail, redirect } from '@sveltejs/kit';
import { createUser } from '$lib/server/userService';
import { generateToken, setAuthTokenCookie } from '$lib/server/auth';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username')?.toString();
    const password = data.get('password')?.toString();

    if (!username || !password) {
      return fail(400, {
        message: 'Missing username or password',
        username,
      });
    }

    try {
      const userId = await createUser(username, password);
      const token = generateToken(userId);
      setAuthTokenCookie(cookies, token);
    } catch (error) {
      console.error('Registration error:', error);
      return fail(500, {
        message: 'Could not register user. Please try again.',
        username,
      });
    }

    throw redirect(303, '/'); // Redirect to home page after successful registration
  },
};
