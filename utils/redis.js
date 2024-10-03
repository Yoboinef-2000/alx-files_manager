import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();

    this.client.on('error', (err) => {
      console.error(`Redis client not connected to the server: ${err.message}`);
    });

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  isAlive() {
    return this.client.connected;
  }

  async get(stringKey) {
    const whatImGetting = await this.getAsync(stringKey);
    return whatImGetting;
  }

  async set(stringKey, aValue, durationInSecs) {
    await this.setAsync(stringKey, aValue, 'EX', durationInSecs);
  }

  async del(stringKey) {
    await this.delAsync(stringKey);
  }
}

const redisClient = new RedisClient();
export default redisClient;
