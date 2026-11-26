import { Router } from 'express';
import {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addMember,
  removeMember,
  addHead,
  removeHead,
  addCollaborator,
  removeCollaborator,
  addTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  addTaskType,
  updateTaskType,
  deleteTaskType,
} from '../controllers/department.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getDepartments);
router.get('/:id', getDepartment);
router.post('/', authorize('admin'), createDepartment);
router.put('/:id', authorize('admin'), updateDepartment);
router.delete('/:id', authorize('admin'), deleteDepartment);
router.post('/:id/members', authorize('admin', 'manager'), addMember);
router.delete('/:id/members/:userId', authorize('admin', 'manager'), removeMember);
router.post('/:id/heads', authorize('admin'), addHead);
router.delete('/:id/heads/:userId', authorize('admin'), removeHead);

router.post('/:id/collaborators', authorize('admin', 'manager'), addCollaborator);
router.delete('/:id/collaborators/:userId', authorize('admin', 'manager'), removeCollaborator);

router.post('/:id/templates', authorize('admin', 'manager'), addTaskTemplate);
router.put('/:id/templates/:templateId', authorize('admin', 'manager'), updateTaskTemplate);
router.delete('/:id/templates/:templateId', authorize('admin', 'manager'), deleteTaskTemplate);

router.post('/:id/templates/:templateId/types', authorize('admin', 'manager'), addTaskType);
router.put('/:id/templates/:templateId/types/:typeId', authorize('admin', 'manager'), updateTaskType);
router.delete('/:id/templates/:templateId/types/:typeId', authorize('admin', 'manager'), deleteTaskType);

export default router;
