import { fail, redirect } from '@sveltejs/kit';
import { validateUserPassword } from '$lib/server/userService';
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

    const user = await validateUserPassword(username, password);

    if (!user) {
      return fail(400, {
        message: 'Invalid credentials',
        username,
      });
    }

    try {
      const token = generateToken(user.id);
      setAuthTokenCookie(cookies, token);
    } catch (error) {
      console.error('Login error:', error);
      return fail(500, {
        message: 'Could not log in. Please try again.',
        username,
      });
    }

    throw redirect(303, '/'); // Redirect to home page after successful login
  },
};
