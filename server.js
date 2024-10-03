import express from 'express';
import router from './routes/index'; // Import routes
import dbClient from './utils/db'; // Import the dbClient if required
import redisClient from './utils/redis';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
// Load routes
app.use('/', router);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
