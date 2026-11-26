import { Router } from 'express';
import { body } from 'express-validator';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
  uploadThumbnail,
  attachTable,
  detachTable,
} from '../controllers/project.controller';
import { createProjectTab } from '../controllers/projectTab.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { createUpload } from '../middleware/upload.middleware';

const thumbnailUpload = createUpload('projectThumbnails', {
  imageOnly: true,
  maxSizeMB: 5,
});

const router = Router();

router.use(authenticate);

router.get('/', getProjects);
router.get('/:id', getProject);

router.post(
  '/',
  authorize('admin', 'manager'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
  ],
  createProject
);

router.post(
  '/:id/thumbnail',
  authorize('admin', 'manager'),
  thumbnailUpload.single('thumbnail'),
  uploadThumbnail
);

router.put('/:id', authorize('admin', 'manager'), updateProject);
router.delete('/:id', authorize('admin'), deleteProject);

router.post('/:id/members', authorize('admin', 'manager'), addMember);
router.delete('/:id/members/:userId', authorize('admin', 'manager'), removeMember);

router.post('/:id/tables', authorize('admin', 'manager'), attachTable);
router.delete('/:id/tables/:tableId', authorize('admin', 'manager'), detachTable);

router.post('/:id/project-tabs', authorize('admin', 'manager'), createProjectTab);

export default router;
