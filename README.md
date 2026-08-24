# LMS (Learning Management System)

1. Project Overview

Build a web-based Learning Management and Assessment System for internal company use.

The system combines:

Course-based learning
Practice & quizzes
Standalone exams
Certification
Advanced analytics & reporting
Role-based access control
2. Authentication & Access Rules (CRITICAL)
❌ No “Sign Up / Register” functionality
✅ Only Super Admin can create users
Users login with:
User ID
Password
3. User Roles
🟣 3.1 Super Admin
Permissions:
Create users
Assign roles (Admin / User)
Manage all users
Full system access
🔵 3.2 Admin
Permissions:
👤 User Management:
View all users
Edit users:
Change role(s)
Add additional roles
Update phone number
Change user password
Delete users
❌ Cannot create users
📚 Course Management:
Create folders (categories)
Create/edit/delete courses
Build course structure:
Lessons
Practice blocks
Quiz blocks
Final exam
Upload certificate templates
🧪 Exam Management:
Create standalone exams
Set and edit exam passwords
📊 Reporting:
View analytics
Export reports
🟢 3.3 User
Permissions:
View courses
Take courses
Participate in quizzes, practices, exams
Comment on lessons
View results
Download certificates
4. User Entity Update

Each user must include:

Full Name
User ID
Password
Phone Number (NEW)
Role(s)
5. Course Module (UPDATED)
5.1 Course Structure (Dynamic Flow)

Each course consists of:

Lessons
Practice blocks (NEW)
Quiz blocks
Final Exam
5.2 Lesson Features (UPDATED)

Each lesson supports:

Video upload
PDF upload
PPTX upload
DOCX upload
External video link (e.g. YouTube)

Additional:

Description field (text)
5.3 Practice Module (NEW)
Can be added between lessons
Similar to test (MCQ)
Created by Admin
Button:
👉 “+ Add Practice” (next to “+ Add Lesson”)
5.4 Quiz Module (UPDATED GLOBAL MODULE)

Admins and Super Admins can:

Create quizzes
Add:
Questions
Answers
Time limit per question (NEW)

User:

Enters quiz
Answers questions
Sees result after completion
5.5 Final Exam
Mandatory in course
5–100 questions
Passing score configurable
6. Inline Editing UX (CRITICAL)

❌ No page reload after any action
❌ No redirect or tab reset
✅ User must stay on the same tab (Details / Lessons / Exam / Certificate) after:
Adding content
Editing
Saving
Tabs must work via client-side state (NOT routing)
All actions must be inline:
Add Lesson
Add Practice
Add Quiz
Add Exam
Upload Certificate
Use:
Modals OR inline forms
✅ After action:
Update UI instantly (no refresh)
Keep scroll position
Show new item immediately
“Save” button:
Saves only current section
Does NOT change tab
Does NOT reset page

7. Comments System (PRIVATE)
Users can comment under each lesson
Admin can reply to comments
❗ Comments are PRIVATE:
Only visible to:
That specific user
Admin
Not visible to other users
8. Standalone Exam Module
🔐 Password Protection
Each exam has a password
Required to start exam
Admin can edit password anytime
📊 Results

Admin can:

View all participants
View scores
Export:
1. General Results:
Excel / PDF
2. Individual PDF:

Includes:

Questions
User answers
Correct answers
Score
9. Reports Module (MAJOR UPDATE)
❌ Removed:
Separate “Certificates” section
🔍 Filters (VERY IMPORTANT)

In “Exam Results” list, allow filtering by:

Users
Courses
Score range (%)
Result (Pass / Fail)
Course start date
Course completion date
Certificate (Yes / No)
📊 Dashboard UI Change

Replace top 3 metrics with:

👉 Course-based accordion cards

Each card shows:

Course name
Average exam score (CRITICAL)

Behavior:

Show 3 cards initially
باقي kartlar accordion ilə açılır
10. Champions Module (NEW – ALL ROLES)

Add module:
👉 “Champions”

For each course:

Show Top 5 users
Based on highest scores

Visible to:

Super Admin
Admin
User
11. Quiz Module (Standalone)

Separate from course:

Admin/Super Admin:

Create quiz
Add questions
Set time per question

User:

Take quiz
View result
12. Certificate Module
Upload template (PDF/PPTX)
Auto-fill:
Full Name
Course Name
Completion Date
Download option
13. Validation Rules
Course must have:
≥1 lesson
≥1 final exam
Final exam:
≥5 questions
MCQ:
≥3 answers
Standalone exam:
Must have password
14. UI/UX Requirements
Sidebar:
Courses
Exams
Quiz
Reports
Champions
Users (Admin only)
Course Builder:
Drag & drop
Inline editing
No page refresh
15. File Support
Video
PDF
PPTX
DOCX
External links
16. Output Expectation

Generate:

Full-stack web app
Role-based dashboards
Database schema
API endpoints
Dynamic UI
Export system
Certificate engine
🔥 FINAL PRODUCT DEFINITION

This system is:

👉 Corporate LMS + Assessment + Practice + Analytics Platform

Includes:

Structured learning
Practice-based reinforcement
Secure exams
Private feedback (comments)
Performance benchmarking (Champions)
Deep analytics

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/29b7d24c-9d76-4191-8fed-d7afd74461f2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
