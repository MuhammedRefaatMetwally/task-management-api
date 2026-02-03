# Backend Summary – Task Management API

**Overview**
A production-ready NestJS REST API supporting task management with real-time collaboration via WebSockets.

**Key Features**

* **Authentication:** JWT with refresh tokens and role-based access control (Admin/User)
* **Projects:** Full CRUD, color-coded, with ownership validation
* **Tasks:** Kanban-style drag-and-drop, 4 statuses, 4 priority levels
* **Real-time:** WebSocket notifications using Socket.io
* **File Uploads:** Cloudinary integration for avatars and attachments
* **Security:** Helmet, CORS, bcrypt, and input validation
* **Documentation:** Swagger/OpenAPI available at `/api/docs`
* **DevOps:** Docker & Docker Compose ready

**Tech Stack**
NestJS, TypeScript, PostgreSQL, Prisma ORM, Socket.io, JWT, Cloudinary, Docker

**Quick Start**

```bash
npm install
npx prisma generate
npx prisma db push
npm run start:dev  # http://localhost:3000
```


Do you want me to do that?
