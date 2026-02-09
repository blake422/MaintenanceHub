# MaintenanceHub - Replit Agent Guide

## Overview
MaintenanceHub is an industrial maintenance management platform for manufacturing plants and maintenance teams. It provides comprehensive work order tracking, equipment management, preventive maintenance scheduling, downtime analysis, root cause analysis (RCA), AI-powered troubleshooting, training, and reporting. The platform supports multi-tenant company management with role-based access control (admin, manager, tech) and integrates AI for intelligent maintenance planning. Key features include a tiered subscription system with customizable module permissions, AI-powered image search for parts identification, advanced C4 University training with certificate generation, a role switcher for testing, and a "Path to Excellence" module guiding teams through a 6-step maintenance excellence program based on industry best practices and research.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript (Vite).
- **UI Component System**: Shadcn/ui (Radix UI primitives) with Tailwind CSS.
- **Design System**: Material Design 3 adapted for industrial use, using Inter and JetBrains Mono fonts, HSL color system for light/dark modes, and mobile optimization.
- **State Management**: TanStack Query (React Query) for server state.
- **Routing**: Wouter for client-side routing.
- **Form Handling**: React Hook Form with Zod schema validation.
- **Key Pages**: Dashboard, My Work, Equipment, Work Orders, Inventory, PM Schedules, Downtime, RCA, Troubleshooting, AI Planner, Training, Reports, Admin.

### Backend Architecture
- **Framework**: Express.js with TypeScript (Node.js).
- **API Design**: RESTful API with JSON payloads and session-based authentication.
- **Database Access**: Drizzle ORM with Neon serverless PostgreSQL driver.
- **Authentication**: Replit Auth (OpenID Connect) via Passport.js, with PostgreSQL-backed session storage.
- **Middleware**: Custom middleware for row-level security, multi-tenancy, and role-based access control.
- **File Uploads**: Multer for handling file uploads.
- **File Storage**: Google Cloud Storage for media and documents.
- **AI Integration**: OpenAI API (via Replit AI Integrations) for GPT-4o powered troubleshooting, RCA insights, downtime analysis, and image search.

### Data Storage Solutions
- **Database**: PostgreSQL via Neon serverless.
- **Schema Design**: Multi-tenant, row-level security. Includes companies, users, equipment, work orders, parts, PM schedules, RCAs, troubleshooting sessions, downtime reports, training modules, progress, badges, and certifications.
- **Enums**: `user_role`, `work_order_status`, `work_order_priority`, `work_order_type`, `assetLevel`.
- **Migrations**: Drizzle Kit.

### Authentication and Authorization
- **Authentication Provider**: Custom email/password authentication using Passport.js with bcrypt password hashing.
- **Session Management**: PostgreSQL-backed sessions with auto-refresh and secure httpOnly cookies.
- **Authorization Model**: Role-based access control (RBAC) with 'admin', 'manager', 'tech' roles. Row-level security enforced by middleware. Platform admin role ('platform_admin') for system-wide administration.
- **Approval-Based Access System**: Simplified signup flow where users request access via email, platform admins review and approve requests, and auto-generated access codes are sent to approved users. Users can then sign up with their access code. This prevents unrestricted free trial access while keeping the signup process simple and user-friendly.

### Key Features and Implementations
- **Per-User Billing System**: Automated seat-based Stripe billing with role-based pricing. Managers/Admins billed at $100/month, Technicians at $50/month. Seat counts auto-calculated from active company users, with `/api/billing/seat-summary` endpoint providing real-time breakdown. Stripe integration uses dual price tiers with separate line items per role.
- **Work Order Approval Workflow**: Technicians create draft work orders that require manager approval before execution. Backend enforces state transitions (draft → pending_approval → open) with role-based authorization. Frontend provides "My Drafts" tab for techs, "Pending Approval" tab for managers, and submit/approve/reject actions with proper rejection reason handling. Security-hardened with field-level protection preventing bypass via direct PATCH.
- **Path to Excellence Module**: Comprehensive consultant-focused 6-step implementation tool for achieving maintenance excellence. Features extensive detailed checklists (20-23 tasks per step, 129 total), real-time progress tracking (0-100% per step), notes functionality for documenting findings, and professional PDF report generation using jsPDF. Each step includes clear objectives, timelines, key deliverables, and consultant-grade implementation guidance with granular sub-tasks and specific deliverables. Covers: (1) Equipment Criticality Assessment (20 items), (2) Root Cause Analysis System (22 items), (3) Storeroom MRO Optimization (22 items), (4) PM Excellence (22 items), (5) Data-Driven Performance Management (22 items), and (6) Continuous Improvement & Sustainability (23 items). Progress persists in database with JSONB checklist tracking per step. This is a large, detailed module designed for consultant-led implementations.
- **RCA Oracle**: Full-featured Root Cause Analysis system with multi-tab form (Problem & 5 Whys, Fishbone Diagram, Root Causes, Corrective Actions), AI integration, equipment/work order linking, and historical database with server-side pagination and statistics.
- **Asset Hierarchy System**: Multi-level equipment hierarchy (site, area, line, equipment, component) using `parentEquipmentId` and `hierarchyPath` for tree-structured organization and visualization.
- **User Invitation System**: Admins/managers can invite team members via email with auto-acceptance for new users.
- **AI Troubleshooting**: Simplified one-box UI with an iterative coaching system that guides users through a 6-step process (Identify → Gather → Analyze → Plan → Implement → Observe) using Socratic questioning.
- **PM Import & Optimization**: Upload PDF, Excel, or Word documents to automatically extract PM schedules using AI. System analyzes PM schedules and provides optimization suggestions based on RCM and TPM principles, including frequency adjustments, cost savings, and reliability improvements.
- **Integrations Module**: Complete API integration framework for connecting external CMMS, ERP, and asset management systems. Supports webhooks, REST APIs, and custom integrations with full logging, testing capabilities, and sync management.
- **Server-Authoritative Timer System**: Robust work order timer with pause/resume functionality and break tracking. Uses dedicated `time_entries` table with server-side timestamps to prevent clock drift. Supports work/break entry types with break reasons (lunch, parts_wait, meeting, personal, other). Enforces single active timer per technician with atomic transactions. API endpoints: `/api/timer/start`, `/api/timer/pause`, `/api/timer/resume`, `/api/timer/stop`, `/api/timer/active`.
- **Advanced Inventory Management**: Enhanced parts/inventory system with location filtering, status filtering (in-stock/low-stock/out-of-stock), low stock alerts, barcode scanner integration for quick part lookup, and quick "Add to Work Order" functionality allowing managers to assign parts directly to open work orders.
- **Stakeholder Interview Tool**: Voice recording system integrated into the Path to Excellence assessment workflow. Features include role-based question guides for technicians/supervisors/managers/planners/storeroom/operations staff, audio recording with Web Audio API, AI-powered transcription via OpenAI Whisper, GPT-4 summarization with pain point extraction and severity classification, manual transcript entry option, and cross-interview rollup summary generation. Supports consent capture and links interviews to assessment deliverables. Audio recordings are stored privately in object storage (`.private/interviews/{companyId}/`) using `uploadFilePrivate()` and secured with time-limited signed URLs (1-hour expiry) fetched through authenticated API endpoints. Retry transcription available for failed attempts. API endpoints: `/api/interview-sessions` (CRUD), `/api/interview-sessions/:id/audio` (transcription), `/api/interview-sessions/:id/audio-url` (signed URL playback), `/api/interview-sessions/:id/retry-transcription`, `/api/interview-sessions/rollup` (summary).

## External Dependencies

### Third-party Services
- **Replit Auth**: OpenID Connect authentication.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Google Cloud Storage**: Object storage for files.
- **OpenAI API**: AI-powered features (via Replit AI Integrations).
- **Stripe**: Payment processing and subscription management for per-user billing.
- **Resend**: Email delivery service for sending invitation emails.

### Key NPM Packages
- **Database & ORM**: `@neondatabase/serverless`, `drizzle-orm`.
- **Backend**: `express`, `multer`, `@google-cloud/storage`, `openai`, `resend`, `qrcode`, `p-retry`.
- **Authentication**: `passport`, `openid-client`.
- **Frontend**: `react`, `@tanstack/react-query`, `wouter`, `react-hook-form`, `zod`, `tailwindcss`, `@radix-ui/*`, `recharts`, `jsPDF`.