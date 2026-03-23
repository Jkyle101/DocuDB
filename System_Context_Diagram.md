# System Context Diagram

## Context Entities (Formatted)

- **Users/Clients**: The primary actors who upload, download, and manage their documents within the system.
- **Admin**: Responsible for configuring system settings, managing user permissions, and monitoring overall system health.
- **External Applications**: Systems like MS Office or Adobe that interact with DocuDB to open or save files directly.
- **Email Server**: Handles the automated sending of notifications, alerts, and system reports to users and administrators.
- **Database/Storage**: The central repository where all document metadata and files are securely stored.
- **Backup System**: An independent process that regularly copies data from the Database/Storage to ensure data recovery in case of failure.

## Mermaid Source

```mermaid
flowchart LR
    users[Users / Clients]
    admin[Admin]
    external[External Applications\nMS Office, Adobe, etc.]

    system[DocuDB Document Management System]

    email[Email Server]
    storage[(Database / Storage)]
    backup[(Backup System)]

    users <--> |upload, download, organize,\nand manage documents| system
    admin <--> |configure settings,\nmanage permissions,\nmonitor system health| system
    external <--> |open and save files\ndirectly with DocuDB| system

    system --> |send notifications,\nalerts, and reports| email
    system <--> |store and retrieve files,\nmetadata, and system records| storage
    storage --> |scheduled backup copy| backup
    backup -.-> |recovery restore path| storage
```
