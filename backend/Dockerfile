# API-only image — used by the Railway service with root directory /backend
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Uploads live here — attach a Railway volume at /app/uploads to persist them
RUN mkdir -p uploads

EXPOSE 8000
# Railway's healthchecks and public edge reach the container over IPv4
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
