# DocuDB User Flows

## Overview

The DocuDB platform has two main user-flow areas:

1. The Google Drive-like document management side
2. The COPC document workflow side

The main user roles implemented in the system are:

- `faculty`
- `dept_chair`
- `qa_admin`
- `evaluator`
- `superadmin`

## 1. Google Drive-like Side

This side covers daily document management, collaboration, sharing, comments, groups, notifications, search, smart forms, and file organization.

### Role Flows

- `Faculty`
  - Logs in and opens My Drive
  - Browses folders and files
  - Uploads files or creates folders
  - Previews, downloads, renames, moves, favorites, or pins files
  - Shares files/folders and collaborates through comments
  - Checks Shared with Me, Recent, Groups, Notifications, and Settings
  - Uses Smart Forms and the built-in editor
  - Responds to document requests

- `Department Chair`
  - Logs in and opens My Drive
  - Reviews assigned folders and compliance tasks
  - Uploads and organizes department documents
  - Reviews comments and shared files
  - Requests missing documents from faculty
  - Uses collaboration modules and proceeds to COPC review when needed

- `QA Admin`
  - Logs in and opens My Drive
  - Accesses assigned QA folders and checklists
  - Reviews uploaded files and verification status
  - Manages task progress and compliance dashboard widgets
  - Shares, comments, previews, and restores files if needed
  - Uses collaboration tools and proceeds to QA review workflow

- `Evaluator`
  - Logs in to the user workspace
  - Uses Shared, Recent, Notifications, and COPC entry points
  - Previews and downloads accessible documents
  - Reviews final materials needed for evaluation

- `Superadmin`
  - Logs in to the admin side
  - Manages users, groups, tasks, and assignments
  - Uses Admin Drive and Admin Workspace
  - Reviews logs, analytics, and trash management
  - Opens COPC program management

## 2. COPC Document System

This side covers program initialization, role assignment, submission, department review, QA compliance review, evaluation, package generation, final approval, and archiving.

### Role Flows

- `Faculty`
  - Opens COPC Workflow or COPC Upload
  - Selects assigned program
  - Uploads required documents into COPC folders
  - Checks completeness and task status
  - Revises files when rejected or requested
  - Tracks notifications and waits for review results

- `Department Chair`
  - Opens COPC Workflow
  - Selects program
  - Monitors faculty submission status
  - Opens Department Review page
  - Reviews submissions against checklist
  - Approves or rejects files and sends revision feedback
  - Forwards approved files to QA stage

- `QA Admin`
  - Opens COPC Workflow
  - Selects program
  - Reviews compliance summary and pending QA items
  - Opens QA Review page
  - Tags document categories and verifies compliance
  - Approves or rejects documents
  - Adds observations and prepares the package for compilation

- `Evaluator`
  - Opens Evaluation Stage
  - Selects assigned program
  - Accesses approved tree and COPC package
  - Reviews evidence and downloads materials
  - Generates or downloads evaluation report

- `Superadmin`
  - Opens COPC Workflow
  - Initializes COPC program structure
  - Assigns uploaders, department chairs, QA admins, and evaluators
  - Monitors workflow summary and status
  - Opens and downloads package files
  - Compiles package
  - Finalizes COPC Ready state and locks documents
  - Submits to CHED and archives the program

## Diagram Files

- Google Drive-like side source: [User_Flow_Google_Drive_Side.mmd](/c:/Users/HP/Documents/CAPSTONE/docudb/User_Flow_Google_Drive_Side.mmd)
- Google Drive-like side image: [User_Flow_Google_Drive_Side.png](/c:/Users/HP/Documents/CAPSTONE/docudb/User_Flow_Google_Drive_Side.png)
- COPC workflow source: [User_Flow_COPC_Document_System.mmd](/c:/Users/HP/Documents/CAPSTONE/docudb/User_Flow_COPC_Document_System.mmd)
- COPC workflow image: [User_Flow_COPC_Document_System.png](/c:/Users/HP/Documents/CAPSTONE/docudb/User_Flow_COPC_Document_System.png)
