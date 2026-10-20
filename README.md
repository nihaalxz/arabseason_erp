# Arabseason ERP

A professional Enterprise Resource Planning system for Arabseason, built with Django (Backend) and React (Frontend).

## Production Deployment (Render)

### 1. Backend Service (Web Service)

- **Environment**: Python
- **Build Command**: `cd backend && pip install -r requirements.txt && python manage.py collectstatic --noinput`
- **Start Command**: `cd backend && gunicorn config.wsgi:application`
- **Required Environment Variables**:
  - `SECRET_KEY`: A long random string.
  - `DEBUG`: `False`
  - `DATABASE_URL`: Your Neon DB connection string.
  - `ALLOWED_HOSTS`: `your-backend-url.onrender.com`
  - `CORS_ALLOWED_ORIGINS`: `https://your-frontend-url.onrender.com`
  - `CSRF_TRUSTED_ORIGINS`: `https://your-frontend-url.onrender.com`

### 2. Frontend Service (Static Site)

- **Environment**: Static
- **Build Command**: `cd frontend && npm install && npm run build`
- **Publish Directory**: `frontend/dist`
- **Environment Variables**:
  - `VITE_API_URL`: `https://your-backend-url.onrender.com/api/`

## Local Development

### Backend

1. `cd backend`
2. `pip install -r requirements.txt`
3. `python manage.py runserver`

### Frontend

1. `cd frontend`
2. `npm install`
3. `npm run dev`

## License

Private / Proprietary
