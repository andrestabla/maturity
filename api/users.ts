import { canManageUsers } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createUserRecord,
  deleteUserRecord,
  getUserDirectory,
  updateUserRecord,
} from '../lib/store.js';
import type { UserMutationInput, UserUpdateInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface UserDeletePayload {
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'GET') {
    const users = await getUserDirectory();

    return jsonResponse({
      users,
    });
  }

  if (!canManageUsers(user.role)) {
    return errorResponse(403, 'You do not have permission to manage users');
  }

  if (request.method === 'POST') {
    const payload = await readJson<UserMutationInput>(request);

    if (!payload.name || !payload.email || !payload.role || !payload.password) {
      return errorResponse(400, 'Name, email, role and password are required');
    }

    if (payload.password.length < 10) {
      return errorResponse(400, 'The password must be at least 10 characters long');
    }

    try {
      const createdUser = await createUserRecord(payload);

      return jsonResponse(
        {
          user: createdUser,
        },
        {
          status: 201,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create user';
      return errorResponse(400, message);
    }
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<UserUpdateInput>(request);

    if (!payload.id || !payload.name || !payload.email || !payload.role) {
      return errorResponse(400, 'Id, name, email and role are required');
    }

    if (payload.password && payload.password.length < 10) {
      return errorResponse(400, 'The password must be at least 10 characters long');
    }

    try {
      const updatedUser = await updateUserRecord(payload);

      if (!updatedUser) {
        return errorResponse(404, 'User not found');
      }

      return jsonResponse({
        user: updatedUser,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update user';
      return errorResponse(400, message);
    }
  }

  if (request.method === 'DELETE') {
    const payload = await readJson<UserDeletePayload>(request);

    if (!payload.id) {
      return errorResponse(400, 'User id is required');
    }

    if (payload.id === user.id) {
      return errorResponse(400, 'You cannot delete your own account');
    }

    const deleted = await deleteUserRecord(payload.id);

    if (!deleted) {
      return errorResponse(404, 'User not found');
    }

    return jsonResponse({
      ok: true,
    });
  }

  return errorResponse(405, 'Method not allowed');
}
