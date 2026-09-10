FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2 and reportlab
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["sh", "-c", "python seed_data.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
