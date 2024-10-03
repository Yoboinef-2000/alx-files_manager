import app from '../server'; // Assuming this is where your express app is defined
import request from 'supertest';

global.request = request(app);
