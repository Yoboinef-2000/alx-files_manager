import redisClient from '../../utils/redis';

describe('redisClient', () => {
  beforeAll(() => {
    // Perform any setup before tests (e.g., starting mock server)
  });

  it('should be connected to Redis', () => {
    expect(redisClient.isAlive()).toBe(true);
  });

  it('should set and get values correctly', async () => {
    await redisClient.set('test_key', 'test_value', 10);
    const value = await redisClient.get('test_key');
    expect(value).toBe('test_value');
  });

  it('should expire keys after a given time', async () => {
    await redisClient.set('expire_key', 'expire_value', 1); // 1 second
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
    const value = await redisClient.get('expire_key');
    expect(value).toBe(null);
  });

  afterAll(() => {
    redisClient.client.quit();
  });
});
