import { v4 as uuidv4 } from 'uuid';
import { mkdirSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { ObjectId } from 'mongodb';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    // Check if the name is provided
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    // Check if the type is valid
    const validTypes = ['folder', 'file', 'image'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    // Check if data is provided for file or image types
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Check if parentId is valid if provided
    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });

    const fileDocument = {
      userId: user._id.toString(),
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'folder') {
      const newFile = await dbClient.db.collection('files').insertOne(fileDocument);
      return res.status(201).json({
        id: newFile.insertedId,
        userId: fileDocument.userId,
        name: fileDocument.name,
        type: fileDocument.type,
        isPublic: fileDocument.isPublic,
        parentId: fileDocument.parentId,
      });
    }

    // If type is file or image, handle file storage
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }

    const localPath = path.join(folderPath, uuidv4());
    const fileContent = Buffer.from(data, 'base64');

    try {
      writeFileSync(localPath, fileContent);
    } catch (err) {
      return res.status(500).json({ error: 'Cannot store the file' });
    }

    fileDocument.localPath = localPath;
    const newFile = await dbClient.db.collection('files').insertOne(fileDocument);

    return res.status(201).json({
      id: newFile.insertedId,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
      localPath: fileDocument.localPath,
    });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    if (!ObjectId.isValid(fileId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(fileId),
      userId,
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  // Get all files with pagination
  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;

    const pipeline = [
      { $match: { userId, parentId: parentId === '0' ? 0 : parentId } },
      { $skip: page * 20 },
      { $limit: 20 },
    ];

    const files = await dbClient.db.collection('files').aggregate(pipeline).toArray();

    return res.status(200).json(files);
  }
}

export default FilesController;
