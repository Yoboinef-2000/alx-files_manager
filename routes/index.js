import express from 'express';
import AppController from '../controllers/AppController'; // Import the AppController
import UsersController from '../controllers/UsersController'; // Import UsersController
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const router = express.Router();

// Define the status endpoint
router.get('/status', AppController.getStatus);

// Define the stats endpoint
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);

router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UsersController.getMe);

router.post('/files', FilesController.postUpload);

router.get('/files/:id', FilesController.getShow);
router.get('/files', FilesController.getIndex);

export default router;
