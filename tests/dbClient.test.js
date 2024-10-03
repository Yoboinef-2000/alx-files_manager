import dbClient from '../../utils/db';

describe('dbClient', () => {
  it('should be connected to the MongoDB server', () => {
    expect(dbClient.isAlive()).toBe(true);
  });

  it('should have the correct database name', () => {
    expect(dbClient.db.databaseName).toBe(process.env.DB_NAME || 'files_manager');
  });

  it('should count the number of users in the users collection', async () => {
    const userCount = await dbClient.nbUsers();
    expect(userCount).toBeGreaterThanOrEqual(0);
  });

  it('should count the number of files in the files collection', async () => {
    const fileCount = await dbClient.nbFiles();
    expect(fileCount).toBeGreaterThanOrEqual(0);
  });
});
