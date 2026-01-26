# DocuDB 📚

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-blue.svg)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-19+-61dafb.svg)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](https://www.docker.com/)

A comprehensive document management system designed for educational institutions, featuring secure file sharing, version control, group collaboration, and administrative dashboards.

## 🌟 Features

### Core Functionality
- **Secure Authentication**: JWT-based user authentication with role-based access control
- **File Management**: Upload, download, organize, and manage documents with folder structure
- **Version Control**: Track file changes and restore previous versions
- **Advanced Search**: Search files by name and content (text files)
- **File Sharing**: Share files and folders with other users with granular permissions
- **Trash System**: Soft delete with recovery options

### Collaboration Tools
- **Group Management**: Create and manage collaborative groups for classes, departments, or projects
- **Group Sharing**: Share content within groups with role-based permissions
- **Notifications**: Real-time notifications for group activities and file sharing
- **Comments**: Add comments to files for collaboration

### Administrative Features
- **User Management**: Admin dashboard for managing users, roles, and permissions
- **System Analytics**: Comprehensive logging and analytics dashboard
- **Audit Logging**: Track all system activities for security and compliance
- **Storage Analytics**: Monitor file types, storage usage, and user activity
- **Group Administration**: Manage groups, members, and group content

### Technical Features
- **Responsive Design**: Mobile-friendly interface using Bootstrap
- **Real-time Updates**: Live data refresh and activity monitoring
- **Security**: Password hashing, CORS protection, secure file handling
- **Scalable Architecture**: Modular backend with MongoDB for data persistence
- **Docker Support**: Containerized deployment for easy scaling

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern JavaScript library for building user interfaces
- **Vite** - Fast build tool and development server
- **React Router** - Declarative routing for React
- **Bootstrap 5** - Responsive CSS framework
- **React Icons** - Beautiful icon library
- **Axios** - HTTP client for API requests
- **Recharts** - Composable charting library

### Backend
- **Node.js** - JavaScript runtime for server-side development
- **Express.js** - Fast, unopinionated web framework
- **MongoDB** - NoSQL document database
- **Mongoose** - MongoDB object modeling for Node.js
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
- **Multer** - Middleware for handling file uploads
- **Nodemailer** - Email sending functionality
- **CORS** - Cross-origin resource sharing

### DevOps & Deployment
- **Docker** - Containerization platform
- **PM2** - Production process manager
- **Nginx** - Web server and reverse proxy
- **MongoDB Compass** - GUI for MongoDB management

## 🚀 Quick Start

### Prerequisites
- Node.js 16.x or higher
- MongoDB 5.0 or higher
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jkyle101/DocuDB.git
   cd docudb
   ```

2. **Backend Setup**
   ```bash
   cd server
   npm install

   # Create environment file
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Frontend Setup**
   ```bash
   cd ../client
   npm install

   # Create environment file
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB service
   sudo systemctl start mongodb  # Linux
   # or
   brew services start mongodb/brew/mongodb-community  # macOS
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1: Start backend
   cd server
   npm start

   # Terminal 2: Start frontend
   cd ../client
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

### Docker Deployment (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```



## 📖 Usage

### User Roles
- **User**: Basic file management and collaboration features
- **Admin**: User management and system monitoring
- **Superadmin**: Full system access including user role management

### Key Workflows

1. **File Management**
   - Upload files and create folders
   - Organize content in hierarchical structure
   - Search and filter files
   - Share with other users or groups

2. **Collaboration**
   - Create or join groups
   - Share content within groups
   - Add comments to files
   - Receive notifications

3. **Administration**
   - Manage user accounts and roles
   - Monitor system activity
   - View analytics and reports
   - Configure system settings

## 🏗️ API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### File Management Endpoints
- `GET /api/files` - Get user's files
- `POST /api/files/upload` - Upload files
- `GET /api/files/:id` - Get file details
- `PUT /api/files/:id` - Update file
- `DELETE /api/files/:id` - Delete file

### User Management Endpoints (Admin)
- `GET /api/users` - Get all users
- `PUT /api/users/:id/role` - Update user role
- `PUT /api/users/:id/status` - Toggle user status

### Group Management Endpoints
- `GET /api/groups` - Get user's groups
- `POST /api/groups` - Create group
- `POST /api/groups/:id/members` - Add group member

For complete API documentation, see the backend code or use tools like Postman to explore the endpoints.

## 🧪 Testing

```bash
# Run backend tests
cd server
npm test

# Run frontend tests
cd ../client
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for educational institutions to streamline document management
- Inspired by modern collaboration tools like Google Drive and Microsoft Teams
- Special thanks to the open-source community for the amazing tools and libraries

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the [Deployment Guide](DEPLOYMENT_GUIDE.md) for detailed setup instructions
- Review the [System Flows](system_flows.md) for detailed functionality overview

---

**Default Admin Credentials** (Change immediately after first login!)
- Email: `admin@school.edu`
- Password: `admin123`

Happy documenting! 📚✨
