import {
  getAdminCenterData,
  updateBrandingSettings,
  updateExperienceSettings,
  updateHomeContentSettings,
  updateInstitutionSettings,
  updateWorkflowSettings,
} from '../lib/admin-center.js';
import { canManageUsers } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import type {
  BrandingSettings,
  ExperienceSettings,
  HomeContentSettings,
  InstitutionSettings,
  WorkflowSettings,
} from '../src/types.js';

export const config = {
  runtime: 'edge',
};

type AdminCenterPatchPayload =
  | {
      section: 'institution';
      data: InstitutionSettings;
    }
  | {
      section: 'branding';
      data: BrandingSettings;
    }
  | {
      section: 'experience';
      data: ExperienceSettings;
    }
  | {
      section: 'workflow';
      data: WorkflowSettings;
    }
  | {
      section: 'home-content';
      data: HomeContentSettings;
    };

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);

    if (!user) {
      return errorResponse(401, 'Authentication required');
    }

    if (!canManageUsers(user.role)) {
      return errorResponse(403, 'Solo los administradores pueden acceder a Gobierno');
    }

    if (request.method === 'GET') {
      const data = await getAdminCenterData();

      return jsonResponse(
        {
          data,
        },
        {
          headers: {
            'cache-control': 'no-store',
          },
        },
      );
    }

    if (request.method === 'PATCH') {
      const payload = await readJson<AdminCenterPatchPayload>(request);

      if (payload.section === 'institution') {
        const institution = await updateInstitutionSettings(payload.data, {
          id: user.id,
          name: user.name,
        });

        return jsonResponse({
          institution,
        });
      }

      if (payload.section === 'branding') {
        const branding = await updateBrandingSettings(payload.data, {
          id: user.id,
          name: user.name,
        });

        return jsonResponse({
          branding,
        });
      }

      if (payload.section === 'experience') {
        const experience = await updateExperienceSettings(payload.data, {
          id: user.id,
          name: user.name,
        });

        return jsonResponse({
          experience,
        });
      }

      if (payload.section === 'workflow') {
        const workflow = await updateWorkflowSettings(payload.data, {
          id: user.id,
          name: user.name,
        });

        return jsonResponse({
          workflow,
        });
      }

      if (payload.section === 'home-content') {
        const homeContent = await updateHomeContentSettings(payload.data, {
          id: user.id,
          name: user.name,
        });

        return jsonResponse({
          homeContent,
        });
      }

      return errorResponse(400, 'Section not supported');
    }

    return errorResponse(405, 'Method not allowed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update admin center';
    return errorResponse(400, message);
  }
}
