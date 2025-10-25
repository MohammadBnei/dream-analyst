// src/routes/register/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { hashPassword, generateToken } from '$lib/server/auth';
import { sql } from '$lib/server/db';

export const actions = {
  register: async ({ request, cookies }) => {  // Renamed from 'default'
    const data = await request.formData();
    const username = data.get('username') as string;
    const email = data.get('email') as string;
    const password = data.get('password') as string;

    if (!username || !email || !password) {
      return fail(400, { username, email, message: 'All fields are required.' });
    }

    if (password.length < 6) {
      return fail(400, { username, email, message: 'Password must be at least 6 characters long.' });
    }

    try {
      // Check if username or email already exists
      const existingUser = await sql`
        SELECT id FROM users WHERE username = ${username} OR email = ${email}
      `;

      if (existingUser.length > 0) {
        return fail(409, { username, email, message: 'Username or email already exists.' });
      }

      const hashedPassword = await hashPassword(password);

      const [newUser] = await sql`
        INSERT INTO users (username, email, password_hash)
        VALUES (${username}, ${email}, ${hashedPassword})
        RETURNING id;
      `;

      if (!newUser) {
        return fail(500, { username, email, message: 'Failed to create user.' });
      }

      const token = generateToken(newUser.id);

      cookies.set('jwt', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });

      throw redirect(303, '/'); // Redirect to home page after successful registration
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof Error && 'message' in error) {
        return fail(500, { username, email, message: `Server error: ${error.message}` });
      }
      return fail(500, { username, email, message: 'An unexpected error occurred.' });
    }
  }
};
