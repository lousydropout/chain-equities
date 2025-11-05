/**
 * @file Main entry point for ChainEquity backend server
 * @notice Fastify server with logging, security, and health check endpoint
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { connect, close } from './db/index';
import { migrate } from './db/migrations';
import { Indexer } from './services/chain/indexer';
import { companyRoutes } from './routes/company';

// Get port from environment variable, default to 4000
const PORT = Number(process.env.PORT) || 4000;

// Initialize Fastify with Pino logger
const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  fastify.log.info(`${signal} received, shutting down gracefully...`);
  await Indexer.stop().catch((err) => {
    console.error('Error stopping indexer:', err);
  });
  close(); // Close database connection
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
const start = async () => {
  try {
    // Initialize database (only in development or with AUTO_MIGRATE flag)
    const shouldAutoMigrate =
      process.env.NODE_ENV === 'development' ||
      process.env.AUTO_MIGRATE === 'true';

    if (shouldAutoMigrate) {
      console.log('🔄 Auto-running migrations on startup...');
      const db = connect();
      migrate(db);
      console.log('✅ Database initialized');
    } else {
      console.log(
        "ℹ️  Skipping auto-migration (run 'bun run db:migrate' manually)"
      );
      // Still connect to ensure database exists
      connect();
    }

    // Register security plugins
    await fastify.register(helmet);
    await fastify.register(cors);

    // Register API routes
    await fastify.register(companyRoutes, { prefix: '/api' });

    // Health check endpoint
    fastify.get('/ping', async (request, reply) => {
      return { status: 'ok' };
    });

    // Start event indexer
    Indexer.start().catch((err) => {
      console.error('❌ Indexer failed to start:', err);
      process.exit(1);
    });

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

