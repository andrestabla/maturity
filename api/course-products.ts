import {
  canCreateCourseProducts,
  canDeleteCourseProducts,
  canEditCourseProduct,
} from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createCourseProductRecord,
  deleteCourseProductRecord,
  findCourseProductById,
  updateCourseProductRecord,
} from '../lib/store.js';
import type { CourseProductMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface ProductCreatePayload extends CourseProductMutationInput {
  courseSlug?: string;
}

interface ProductUpdatePayload extends Partial<CourseProductMutationInput> {
  courseSlug?: string;
  id?: string;
}

interface ProductDeletePayload {
  courseSlug?: string;
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'POST') {
    if (!canCreateCourseProducts(user.role)) {
      return errorResponse(403, 'You do not have permission to create course products');
    }

    const payload = await readJson<ProductCreatePayload>(request);

    if (!payload.courseSlug) {
      return errorResponse(400, 'Course slug is required');
    }

    const product = await createCourseProductRecord(payload.courseSlug, {
      title: payload.title,
      stage: payload.stage,
      format: payload.format,
      owner: payload.owner,
      status: payload.status,
      summary: payload.summary,
      body: payload.body,
      tags: payload.tags,
      version: payload.version,
    });

    if (!product) {
      return errorResponse(404, 'Course not found');
    }

    return jsonResponse({ product }, { status: 201 });
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<ProductUpdatePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and product id are required');
    }

    const current = await findCourseProductById(payload.courseSlug, payload.id);

    if (!current) {
      return errorResponse(404, 'Product not found');
    }

    if (!canEditCourseProduct(user.role, current.owner)) {
      return errorResponse(403, 'You do not have permission to update this product');
    }

    const product = await updateCourseProductRecord(payload.courseSlug, payload.id, payload);

    return jsonResponse({ product });
  }

  if (request.method === 'DELETE') {
    if (!canDeleteCourseProducts(user.role)) {
      return errorResponse(403, 'You do not have permission to delete course products');
    }

    const payload = await readJson<ProductDeletePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and product id are required');
    }

    const deleted = await deleteCourseProductRecord(payload.courseSlug, payload.id);

    if (!deleted) {
      return errorResponse(404, 'Product not found');
    }

    return jsonResponse({ ok: true });
  }

  return errorResponse(405, 'Method not allowed');
}
