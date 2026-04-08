import {
  canCreateHelpDeskTicket,
  canManageHelpDeskTickets,
  canOperateHelpDeskTicket,
} from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createHelpDeskTicketRecord,
  findHelpDeskTicketById,
  listHelpDeskTicketsRecord,
  updateHelpDeskTicketRecord,
} from '../lib/store.js';
import type {
  HelpDeskTicketMutationInput,
  HelpDeskTicketUpdateInput,
} from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface HelpDeskUpdatePayload extends Partial<HelpDeskTicketUpdateInput> {
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'GET') {
    const tickets = await listHelpDeskTicketsRecord();
    return jsonResponse({ tickets });
  }

  if (request.method === 'POST') {
    if (!canCreateHelpDeskTicket(user.role)) {
      return errorResponse(403, 'No tienes permisos para crear tickets de soporte.');
    }

    try {
      const payload = await readJson<HelpDeskTicketMutationInput>(request);

      if (!payload.title?.trim() || !payload.description?.trim()) {
        return errorResponse(400, 'Título y descripción son obligatorios.');
      }

      const ticket = await createHelpDeskTicketRecord(payload, {
        id: user.id,
        name: user.name,
      });

      return jsonResponse({ ticket }, { status: 201 });
    } catch (error) {
      return errorResponse(
        400,
        error instanceof Error ? error.message : 'No fue posible crear el ticket.',
      );
    }
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<HelpDeskUpdatePayload>(request);

    if (!payload.id) {
      return errorResponse(400, 'Ticket id is required');
    }

    const current = await findHelpDeskTicketById(payload.id);

    if (!current) {
      return errorResponse(404, 'Ticket not found');
    }

    if (!canOperateHelpDeskTicket(user.role, user.id, current.requesterId, current.assigneeId)) {
      return errorResponse(403, 'No tienes permisos para actualizar este ticket.');
    }

    const canManageWorkflow =
      canManageHelpDeskTickets(user.role) || current.assigneeId === user.id;

    const requesterCanClose = user.id === current.requesterId && payload.status === 'Cerrado';

    const nextPayload: Partial<HelpDeskTicketUpdateInput> = canManageWorkflow
      ? payload
      : {
          title: payload.title,
          description: payload.description,
          category: payload.category,
          priority: payload.priority,
          courseSlug: payload.courseSlug,
          stageId: payload.stageId,
          status: requesterCanClose ? payload.status : undefined,
        };

    try {
      const ticket = await updateHelpDeskTicketRecord(payload.id, nextPayload);

      if (!ticket) {
        return errorResponse(404, 'Ticket not found');
      }

      return jsonResponse({ ticket });
    } catch (error) {
      return errorResponse(
        400,
        error instanceof Error ? error.message : 'No fue posible actualizar el ticket.',
      );
    }
  }

  return errorResponse(405, 'Method not allowed');
}
