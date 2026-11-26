import { Router } from 'express';
import {
  getCredentials,
  getExpiringCredentials,
  getCredential,
  createCredential,
  updateCredential,
  deleteCredential,
  revealCredential,
  getAccessLog,
} from '../controllers/credential.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// No global role gate here beyond "logged in" — a department head can be any
// role (admin/manager/member), so per-department authorization is enforced
// inside the controller (canManage/canView), not at the route layer.
router.use(authenticate);

router.get('/', getCredentials);
router.get('/expiring', getExpiringCredentials);
router.get('/:id', getCredential);
router.get('/:id/access-log', getAccessLog);
router.post('/', createCredential);
router.post('/:id/reveal', revealCredential);
router.put('/:id', updateCredential);
router.delete('/:id', deleteCredential);

export default router;
