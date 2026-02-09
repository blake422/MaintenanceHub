# MaintenanceHub

A full-stack industrial maintenance management platform for equipment tracking, work orders, preventive maintenance scheduling, downtime analysis, and training management.

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for development and builds
- TanStack Query for server state management
- Radix UI + Tailwind CSS for components
- Wouter for routing

**Backend:**
- Node.js with Express
- TypeScript
- Drizzle ORM with PostgreSQL (Neon)
- Passport.js for authentication
- Pino for structured logging

**Infrastructure:**
- Stripe for billing
- OpenAI for AI-powered features
- Resend for transactional emails

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (or Neon account)
- npm or yarn

### Environment Variables

Create a `.env` file in the root directory. See `.env.example` for reference.

**Required:**
```
DATABASE_URL=postgresql://...
SESSION_SECRET=your-32-character-minimum-secret
```

**Optional (for full functionality):**
```
STRIPE_SECRET_KEY=sk_...
AI_INTEGRATIONS_OPENAI_API_KEY=...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
RESEND_API_KEY=re_...
DEFAULT_OBJECT_STORAGE_BUCKET_ID=...
```

### Installation

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities
├── server/                 # Express backend
│   ├── config/             # Environment configuration
│   ├── middleware/         # Express middleware
│   ├── routes/             # API route handlers
│   ├── validation/         # Zod validation schemas
│   └── storage.ts          # Database access layer
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Drizzle schema definitions
└── package.json
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run check` | TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run db:push` | Push schema changes to database |

## Key Features

- **Equipment Management**: Hierarchical asset tracking with QR codes
- **Work Orders**: Role-based creation, approval, and execution workflow
- **Preventive Maintenance**: PM schedule management with AI recommendations
- **Downtime Analysis**: Downtime recording with AI-powered root cause analysis
- **Training Management**: Modular courses with progress tracking
- **Multi-tenant**: Company-based data isolation with role-based access control

## Architecture

### Authentication Flow

1. User logs in via `/api/auth/login`
2. Passport.js validates credentials against bcrypt hash
3. Session stored in PostgreSQL via `connect-pg-simple`
4. Subsequent requests validated via session cookie
5. `loadCurrentUser` middleware normalizes user context
6. `requireCompany` / `requireRole` middleware enforces access

### API Design

- RESTful endpoints under `/api/*`
- Zod validation on request bodies
- Structured error responses with appropriate HTTP status codes
- Row-level security via company ID filtering

## License

MIT
