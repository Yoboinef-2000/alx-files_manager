import Bull from 'bull';
import dbClient from './utils/db';
import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import { writeFileSync } from 'fs';
import path from 'path';

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.db.collection('files').findOne({
    _id: ObjectId(fileId),
    userId,
  });

  if (!file) {
    throw new Error('File not found');
  }

  const filePath = file.localPath;

  if (file.type !== 'image') {
    throw new Error('File is not an image');
  }

  const thumbnailSizes = [500, 250, 100];
  
  for (const size of thumbnailSizes) {
    const options = { width: size };
    try {
      const thumbnail = await imageThumbnail(filePath, options);
      const thumbnailPath = `${filePath}_${size}`;
      writeFileSync(thumbnailPath, thumbnail);
    } catch (err) {
      console.error(`Error generating thumbnail for size ${size}:`, err);
      throw new Error('Failed to generate thumbnail');
    }
  }
});

console.log('Worker is up and running...');
