import { v4 as uuidv4 } from 'uuid';
import { mkdirSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { ObjectId } from 'mongodb';
import Bull from 'bull';


const fileQueue = new Bull('fileQueue');

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

    if (type === 'image') {
      await fileQueue.add({ userId: user._id.toString(), fileId: newFile.insertedId });
    }

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

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;

    try {
      // Check if user exists
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Find the file document based on ID and user
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: userId });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Update the isPublic attribute to true
      file.isPublic = true;
      await dbClient.db.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });

      // Return the updated file document
      return res.status(200).json(file);
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Method to unpublish a file
  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;

    try {
      // Check if user exists
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Find the file document based on ID and user
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: userId });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Update the isPublic attribute to false
      file.isPublic = false;
      await dbClient.db.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });

      // Return the updated file document
      return res.status(200).json(file);
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getFile(req, res) {
    const token = req.headers['x-token'];
    const fileId = req.params.id;

    // Check if the fileId is valid
    if (!ObjectId.isValid(fileId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      // Find the file by ID
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) });

      // If the file is not found, return 404
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if the file is a folder, which doesn't have content
      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      // If the file is not public, check for authentication
      const userId = token ? await redisClient.get(`auth_${token}`) : null;

      // If the file is not public and the user is not the owner, return 404
      if (!file.isPublic && (!userId || userId !== file.userId)) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if the file exists locally
      if (!existsSync(file.localPath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Get the MIME type of the file using mime-types module
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';

      // Read the file content
      const fileContent = readFileSync(file.localPath);

      // Set the correct MIME type in the response headers and send the file content
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(fileContent);
      
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default FilesController;
