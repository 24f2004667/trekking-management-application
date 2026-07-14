# Trekking Management Application (TMA) — V2

A role-based web app for managing trekking activities — built for the Modern
Application Development II project.

Admins create and approve treks and manage staff, Trek Staff run the treks
they're assigned to, and Trekkers browse, book, and track their trips.

## Features

- JWT-based authentication with three roles: Admin, Trek Staff, Trekker
- Admin dashboard: manage treks, staff, users, bookings, search, and reports
- Trek Staff dashboard: manage assigned treks, slots, status, and participants
- Trekker dashboard: browse/filter treks, book, cancel, view booking history
- Prevents overbooking, duplicate bookings, and date-clashing bookings
- Background jobs with Celery + Redis: daily trek reminders, a monthly
  activity report emailed to the Admin, and async CSV export of booking history
- Redis caching on trek-listing endpoints

## Tech Stack

**Backend:** Flask, Flask-SQLAlchemy, JWT, Flask-Mail, Celery, Redis, SQLite
**Frontend:** Vue 3 (via CDN, no build step) + Bootstrap 5

## Getting Started

\`\`\`bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
\`\`\`

Make sure Redis is running locally, then start everything with one command:

\`\`\`bash
python run.py
\`\`\`

Open **http://localhost:5000** in your browser.

The database and a default Admin account (`admin@tma.com` / `admin123`) are
created automatically on first run.

## Project Structure

\`\`\`
backend/    Flask app, models, routes, Celery tasks
frontend/   Vue 3 single-page app (index.html + app.js)
run.py      Starts Celery worker, Celery beat, and Flask together
\`\`\`

## Author

Vidisha Goel — 24F2004667