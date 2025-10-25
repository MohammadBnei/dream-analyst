// src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { comparePassword, generateToken } from '$lib/server/auth';
import { sql } from '$lib/server/db';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email') as string;
    const password = data.get('password') as string;

    if (!email || !password) {
      return fail(400, { email, message: 'Email and password are required.' });
    }

    try {
      const [user] = await sql`
        SELECT id, password_hash FROM users WHERE email = ${email}
      `;

      if (!user) {
        return fail(400, { email, message: 'Invalid credentials.' });
      }

      const passwordMatch = await comparePassword(password, user.password_hash);

      if (!passwordMatch) {
        return fail(400, { email, message: 'Invalid credentials.' });
      }

      const token = generateToken(user.id);

      cookies.set('jwt', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });

      throw redirect(303, '/'); // Redirect to home page after successful login
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error && 'message' in error) {
        return fail(500, { email, message: `Server error: ${error.message}` });
      }
      return fail(500, { email, message: 'An unexpected error occurred.' });
    }
  }
};
