import {
  recordAdministrativeUserAudit,
  recordAdminLog,
} from '../lib/admin-center.js';
import { canManageUsers } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createUserRecord,
  findUserById,
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

function sanitizeUserSnapshot<T extends object>(user: T | null | undefined) {
  if (!user) {
    return null;
  }

  const safeUser = { ...user } as Record<string, unknown>;
  delete safeUser.passwordHash;
  return safeUser;
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

    if (payload.status !== 'Activo' && !payload.statusReason.trim()) {
      return errorResponse(400, 'Debes registrar el motivo cuando el usuario no inicia activo');
    }

    try {
      const createdUser = await createUserRecord(payload, user.id);

      await recordAdministrativeUserAudit({
        action: 'create',
        actor: {
          id: user.id,
          name: user.name,
        },
        entityId: createdUser.id,
        detail: `Se creó el usuario ${createdUser.email} con estado ${createdUser.status?.toLowerCase()}.`,
        afterValue: JSON.stringify(sanitizeUserSnapshot(createdUser)),
      });
      await recordAdminLog({
        category: 'Administración',
        module: 'Gobierno',
        service: 'Usuarios',
        severity: 'Success',
        event: 'user_created',
        result: 'ok',
        detail: `Se registró ${createdUser.email} con rol principal ${createdUser.role}.`,
        userId: user.id,
        userName: user.name,
      });

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

    if (payload.status !== 'Activo' && !payload.statusReason.trim()) {
      return errorResponse(400, 'Debes registrar el motivo cuando el usuario no queda activo');
    }

    try {
      const before = await findUserById(payload.id);
      const updatedUser = await updateUserRecord(payload);

      if (!updatedUser) {
        return errorResponse(404, 'User not found');
      }

      await recordAdministrativeUserAudit({
        action: 'update',
        actor: {
          id: user.id,
          name: user.name,
        },
        entityId: updatedUser.id,
        detail: `Se actualizó ${updatedUser.email}; estado actual ${updatedUser.status?.toLowerCase()}.`,
        beforeValue: before ? JSON.stringify(sanitizeUserSnapshot(before)) : null,
        afterValue: JSON.stringify(sanitizeUserSnapshot(updatedUser)),
      });
      await recordAdminLog({
        category: 'Administración',
        module: 'Gobierno',
        service: 'Usuarios',
        severity: 'Success',
        event: 'user_updated',
        result: 'ok',
        detail: `Se actualizaron roles, alcance o estado para ${updatedUser.email}.`,
        userId: user.id,
        userName: user.name,
      });

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

    const before = await findUserById(payload.id);
    const deleted = await deleteUserRecord(payload.id);

    if (!deleted) {
      return errorResponse(404, 'User not found');
    }

    await recordAdministrativeUserAudit({
      action: 'delete',
      actor: {
        id: user.id,
        name: user.name,
      },
      entityId: payload.id,
      detail: `Se eliminó el usuario ${before?.email ?? payload.id} del directorio activo.`,
      beforeValue: before ? JSON.stringify(sanitizeUserSnapshot(before)) : null,
    });
    await recordAdminLog({
      category: 'Administración',
      module: 'Gobierno',
      service: 'Usuarios',
      severity: 'Warning',
      event: 'user_deleted',
      result: 'ok',
      detail: `Se retiró ${before?.email ?? payload.id} del directorio.`,
      userId: user.id,
      userName: user.name,
    });

    return jsonResponse({
      ok: true,
    });
  }

  return errorResponse(405, 'Method not allowed');
}
