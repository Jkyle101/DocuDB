# DocuDB Deployment Guide for School Database

This guide provides step-by-step instructions for deploying the DocuDB document management system in a school environment.

## System Overview

DocuDB is a comprehensive document management system designed for educational institutions, featuring:
- User authentication and role-based access control
- File/folder management with version control
- Group collaboration tools
- Administrative dashboards
- Secure file sharing and permissions
- Audit logging and analytics

## Prerequisites

### System Requirements
- **Operating System**: Windows 10/11, Linux (Ubuntu 18.04+), or macOS
- **Node.js**: Version 16.x or higher
- **MongoDB**: Version 5.0 or higher
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: 50GB+ for file storage
- **Network**: LAN access for school network deployment

### Software Dependencies
- Node.js and npm
- MongoDB Community Server
- Git (for cloning repository)

## Deployment Options

### Option 1: Local Development Server (Single Machine)
Suitable for small schools or testing environments.

### Option 2: School Network Deployment (Recommended)
Deploy backend and database on a dedicated server, frontend accessible via school network.

### Option 3: Docker Containerization (Easiest)
For scalable, containerized deployments with automatic orchestration.

### Option 4: PM2 Process Management
For production environments with advanced process management and monitoring.

---

## Deployment Instructions

### Step 1: Environment Setup

#### 1.1 Install Node.js
```bash
# Download and install Node.js from https://nodejs.org/
# Verify installation
node --version
npm --version
```

#### 1.2 Install MongoDB
```bash
# For Windows: Download MongoDB Community Server from https://www.mongodb.com/
# For Linux/Ubuntu:
sudo apt update
sudo apt install mongodb

# Start MongoDB service
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

#### 1.3 Clone Repository
```bash
git clone https://github.com/Jkyle101/DocuDB.git docudb
cd docudb
```

### Step 2: Backend Configuration

#### 2.1 Navigate to Server Directory
```bash
cd server
```

#### 2.2 Install Dependencies
```bash
npm install
```

#### 2.3 Configure Environment Variables
Edit `server/.env` file:

```env
# Server Configuration
PORT=3001
HOST=0.0.0.0

# Database Configuration - Update for school database
MONGO_URI=mongodb://127.0.0.1:27017/docudb

# Security - Generate a strong secret
JWT_SECRET=your_secure_jwt_secret_here_2025

# Client (Frontend) Connection - Update with school server IP
CORS_ORIGIN=http://school-server-ip:5173
```

**Security Note**: Generate a strong JWT secret using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 2.4 Create Uploads Directory
```bash
mkdir uploads
```

### Step 3: Database Setup

#### 3.1 Start MongoDB
```bash
# Windows
net start MongoDB

# Linux
sudo systemctl start mongodb
```

#### 3.2 Create Database User (Optional but Recommended)
```bash
# Connect to MongoDB shell
mongosh

# Switch to admin database
use admin

# Create admin user
db.createUser({
  user: "docudb_admin",
  pwd: "secure_password_here",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase"]
})

# Switch to docudb database
use docudb

# Create application user
db.createUser({
  user: "docudb_user",
  pwd: "app_password_here",
  roles: ["readWrite"]
})
```

Update `server/.env` with new credentials:
```env
MONGO_URI=mongodb://docudb_user:app_password_here@127.0.0.1:27017/docudb
```

### Step 4: Frontend Configuration

#### 4.1 Navigate to Client Directory
```bash
cd ../client
```

#### 4.2 Install Dependencies
```bash
npm install
```

#### 4.3 Configure Backend Connection
Edit `client/.env` file:

```env
# Update with your school server IP and backend port
VITE_BACKEND_URL=http://school-server-ip:3001
```

### Step 5: Initial User Setup

#### 5.1 Start Backend Server
```bash
cd ../server
npm start
```

#### 5.2 Create Initial Admin User
Use MongoDB shell or a GUI tool like MongoDB Compass:

```javascript
// Connect to docudb database
use docudb

// Create initial admin user
db.users.insertOne({
  "email": "admin@school.edu",
  "password": "admin123", // Will be hashed by application
  "name": "School Administrator",
  "role": "superadmin",
  "active": true,
  "createdAt": new Date()
})
```

**Security Note**: Change the default password after first login!

### Step 6: Build and Deploy

#### 6.1 Build Frontend for Production
```bash
cd ../client
npm run build
```

#### 6.2 Serve Frontend
For production, use a web server like Nginx or Apache to serve the built files.

**Option A: Using serve (simple)**
```bash
npm install -g serve
serve -s dist -l 5173
```

**Option B: Using Nginx (recommended for production)**
```nginx
# /etc/nginx/sites-available/docudb
server {
    listen 80;
    server_name school-server-ip;

    root /path/to/docudb/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 6.3 Start Services
Create startup scripts for automatic deployment:

**Windows (startup.bat)**
```batch
@echo off
echo Starting DocuDB Services...

REM Start MongoDB
net start MongoDB

REM Start Backend
cd C:\path\to\docudb\server
start /B npm start

REM Start Frontend
cd C:\path\to\docudb\client
start /B serve -s dist -l 5173

echo DocuDB started successfully!
pause
```

**Linux (startup.sh)**
```bash
#!/bin/bash
echo "Starting DocuDB Services..."

# Start MongoDB
sudo systemctl start mongodb

# Start Backend
cd /path/to/docudb/server
npm start &

# Start Frontend
cd /path/to/docudb/client
serve -s dist -l 5173 &
```

### Step 6.4: Docker Deployment (Alternative)
For easier deployment and better isolation, use Docker:

#### Prerequisites for Docker
```bash
# Install Docker and Docker Compose
# Ubuntu/Debian:
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (optional)
sudo usermod -aG docker $USER
```

#### Docker Deployment Steps
1. **Configure Environment Files**
   ```bash
   # Update server/.env for Docker
   MONGO_URI=mongodb://docudb_user:app_password@docudb_mongodb:27017/docudb
   CORS_ORIGIN=http://localhost:5173

   # Update client/.env for Docker
   VITE_BACKEND_URL=http://localhost:3001
   ```

2. **Create MongoDB Initialization Script**
   ```bash
   mkdir -p docker/mongo-init
   ```
   Create `docker/mongo-init/init.js`:
   ```javascript
   db = db.getSiblingDB('docudb');

   // Create application user
   db.createUser({
     user: 'docudb_user',
     pwd: 'app_password',
     roles: [{ role: 'readWrite', db: 'docudb' }]
   });

   // Create initial admin user
   db.users.insertOne({
     "email": "admin@school.edu",
     "password": "admin123",
     "name": "School Administrator",
     "role": "superadmin",
     "active": true,
     "createdAt": new Date()
   });
   ```

3. **Deploy with Docker Compose**
   ```bash
   # From project root directory
   docker-compose up -d

   # View logs
   docker-compose logs -f

   # Stop services
   docker-compose down
   ```

4. **Access the Application**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3001`
   - MongoDB: `localhost:27017`

#### Docker Production Deployment
For production, update the `docker-compose.yml` environment variables and use a reverse proxy like Nginx or Traefik for SSL termination.

### Step 6.5: PM2 Production Deployment (Alternative)
For advanced process management:

#### Install PM2
```bash
npm install -g pm2
```

#### Configure PM2
The `ecosystem.config.js` file is already created in the project root.

#### Start Services with PM2
```bash
# Start backend with PM2
pm2 start ecosystem.config.js

# Start frontend (build first, then serve)
cd client
npm run build
pm2 serve dist 5173 --name docudb-frontend

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME

# View status
pm2 status
pm2 logs
```

### Step 7: School-Specific Configuration

#### 7.1 Create School User Accounts
1. Access the admin panel at `http://school-server-ip:5173`
2. Login with initial admin credentials
3. Navigate to "Manage Users"
4. Create accounts for teachers, students, and staff

#### 7.2 Set Up Groups and Permissions
1. Create groups for classes, departments, or clubs
2. Assign appropriate permissions
3. Configure sharing settings for collaborative work

#### 7.3 Configure Storage Policies
1. Set up file size limits
2. Configure backup schedules
3. Establish retention policies for school documents

### Step 8: Security Hardening

#### 8.1 Network Security
- Deploy behind school firewall
- Use HTTPS with SSL certificates
- Restrict access to school network only

#### 8.2 Application Security
- Change default admin password
- Regularly update dependencies
- Enable audit logging
- Set up user access controls

#### 8.3 Data Security
- Enable MongoDB authentication
- Regular database backups
- Encrypt sensitive files at rest
- Implement file access logging

### Step 9: Monitoring and Maintenance

#### 9.1 System Monitoring
- Monitor server resources (CPU, RAM, disk usage)
- Set up log rotation
- Monitor MongoDB performance
- Track user activity through admin dashboard

#### 9.2 Backup Strategy
```bash
# MongoDB Backup Script
mongodump --db docudb --out /path/to/backup/$(date +%Y%m%d_%H%M%S)

# File Backup Script
tar -czf /path/to/backup/uploads_$(date +%Y%m%d_%H%M%S).tar.gz /path/to/docudb/server/uploads/
```

#### 9.3 Regular Maintenance
- Weekly security updates
- Monthly backup verification
- Quarterly security audits
- Annual system review

## Troubleshooting

### Common Issues

#### Backend Won't Start
- Check MongoDB connection
- Verify environment variables
- Check port availability (3001)

#### Frontend Won't Load
- Verify VITE_BACKEND_URL configuration
- Check if backend is running
- Clear browser cache

#### Database Connection Errors
- Verify MongoDB service is running
- Check connection string in .env
- Ensure user credentials are correct

#### File Upload Issues
- Check uploads directory permissions
- Verify file size limits
- Check available disk space

### Support
For additional support:
1. Check system logs in `/admin/systemlogs`
2. Review MongoDB logs
3. Consult the DocuDB documentation
4. Contact system administrator

## Performance Optimization

### Database Optimization
- Create indexes on frequently queried fields
- Monitor slow queries
- Optimize MongoDB configuration

### Server Optimization
- Use PM2 for process management
- Implement caching where appropriate
- Configure appropriate file size limits

### Network Optimization
- Use CDN for static assets (optional)
- Implement compression
- Optimize image/file serving

---

## Deployment Summary

I've created a comprehensive deployment setup for DocuDB with multiple deployment options:

### Files Created:
- `DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `docker-compose.yml` - Docker container orchestration
- `server/Dockerfile` - Backend container configuration
- `client/Dockerfile` - Frontend container configuration
- `client/nginx.conf` - Nginx configuration for frontend
- `ecosystem.config.js` - PM2 process management
- `docker/mongo-init/init.js` - MongoDB initialization script
- `backup.sh` - Automated backup script

### Deployment Options Available:

1. **Traditional Deployment** - Manual setup with Node.js and MongoDB
2. **Docker Deployment** - Containerized deployment (recommended for production)
3. **PM2 Deployment** - Advanced process management with PM2

### Key Features:
- School-specific user management and groups
- File sharing and collaboration tools
- Administrative dashboards and analytics
- Secure authentication and permissions
- Audit logging and system monitoring
- Backup and recovery scripts

## Quick Start Checklist

- [ ] Choose deployment method (Docker recommended)
- [ ] Install prerequisites (Node.js, MongoDB, or Docker)
- [ ] Clone repository
- [ ] Configure environment variables for school network
- [ ] Deploy using chosen method
- [ ] Create school user accounts and groups
- [ ] Test file upload and sharing functionality
- [ ] Set up automated backups
- [ ] Configure monitoring and security

**Default Access**: `http://school-server-ip:5173`
**Initial Admin**: `admin@school.edu` / `admin123` (change immediately!)

For detailed instructions, refer to the deployment guide sections above.
