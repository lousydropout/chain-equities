# ChainEquity Backend

Fastify-based backend server for ChainEquity platform.

## Setup

Install dependencies:

```bash
bun install
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Bun automatically loads `.env` files (no additional configuration needed).

## Running

Start the development server:

```bash
bun run dev
```

Or in production:

```bash
bun run start
```

The server will start on `http://localhost:4000` (or the port specified in `PORT` environment variable).

## Health Check

Verify the server is running:

```bash
curl http://localhost:4000/ping
```

Should return: `{"status":"ok"}`

## Project Structure

```
backend/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── plugins/          # Fastify plugins
│   ├── routes/           # API route handlers
│   ├── middleware/       # Request middleware
│   ├── services/         # Business logic services
│   ├── db/               # Database schemas and migrations
│   └── types/            # TypeScript type definitions
├── .env.example          # Environment variable template
└── package.json
```
