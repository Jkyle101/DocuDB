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

// Create indexes for better performance
db.files.createIndex({ "userId": 1 });
db.files.createIndex({ "owner": 1 });
db.files.createIndex({ "parentFolder": 1 });
db.files.createIndex({ "deletedAt": 1 });
db.files.createIndex({ "originalName": "text" });

db.folders.createIndex({ "owner": 1 });
db.folders.createIndex({ "parentFolder": 1 });
db.folders.createIndex({ "deletedAt": 1 });
db.folders.createIndex({ "name": "text" });

db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "active": 1 });

db.logs.createIndex({ "user": 1 });
db.logs.createIndex({ "action": 1 });
db.logs.createIndex({ "date": -1 });

db.groups.createIndex({ "members": 1 });
db.groups.createIndex({ "createdBy": 1 });

print("DocuDB database initialized successfully");
