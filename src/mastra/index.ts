import * as dotenv from "dotenv";
dotenv.config();

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { caseStudyAgent } from './agents/case-study-agent';
import { MongoDBVector } from '@mastra/mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (!process.env.MONGODB_DATABASE) {
  throw new Error('MONGODB_DATABASE environment variable is required');
}

const mongoVector = new MongoDBVector({
  uri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DATABASE
});

export const mastra = new Mastra({
  agents: { caseStudyAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),

   vectors: {
    mongodb: mongoVector,
  },
});
