# API-only image — used by the Railway service with root directory /backend
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Uploads live here — attach a Railway volume at /app/uploads to persist them
RUN mkdir -p uploads

EXPOSE 8000
# Bind :: so Railway private networking (IPv6) can reach the service
CMD uvicorn app.main:app --host :: --port ${PORT:-8000}
