import { Router } from 'express';
import { body } from 'express-validator';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  addComment,
  logHours,
  getAllUserTasks,
  patchTimer,
  delegateTask,
  addContribution,
  getContributions,
  patchContributionTimer,
  toggleContributionDone,
  addDeptRequest,
  updateDeptRequest,
  deleteDeptRequest,
  getIncomingRequests,
  getOutgoingRequests,
} from '../controllers/task.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/all', authorize('admin', 'manager'), getAllUserTasks);
router.get('/requests/incoming', getIncomingRequests);
router.get('/requests/outgoing', getOutgoingRequests);
router.get('/', getTasks);
router.get('/:id', getTask);

router.post(
  '/',
  [body('title').trim().notEmpty().withMessage('Title is required')],
  createTask
);

router.patch('/:id/contribute/timer', patchContributionTimer);
router.patch('/:id/contribute/done', toggleContributionDone);

router.put('/:id', updateTask);
router.put('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

router.post(
  '/:id/comments',
  [body('content').trim().notEmpty().withMessage('Content is required')],
  addComment
);

router.post('/:id/log-hours', logHours);
router.patch('/:id/timer', patchTimer);
router.post('/:id/delegate', delegateTask);
router.post('/:id/contribute', addContribution);
router.get('/:id/contributions', getContributions);

router.post('/:id/requests', addDeptRequest);
router.patch('/:id/requests/:reqId', updateDeptRequest);
router.delete('/:id/requests/:reqId', deleteDeptRequest);

export default router;
