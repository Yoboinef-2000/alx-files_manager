import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}`;

    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.client.connect().then(() => {
      this.db = this.client.db(database);
      console.log('Connected successfully to MongoDB');
    }).catch((err) => {
      console.error('Failed to connect to MongoDB:', err.message);
    });
  }

  // Method to check if MongoDB is alive
  isAlive() {
    return this.client.isConnected();
  }

  // Method to get the number of users in the database
  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  // Method to get the number of files in the database
  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }

  // Method to find user by email and hashed password
  async getUserByEmail(email, hashedPassword) {
    return this.db.collection('users').findOne({ email, password: hashedPassword });
  }
}

const dbClient = new DBClient();
export default dbClient;
