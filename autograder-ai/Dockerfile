# Use Python 3.13 slim image
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install --no-cache-dir poetry

# Copy dependency files
COPY pyproject.toml ./

# Configure poetry to not create virtual env (we're in a container)
RUN poetry config virtualenvs.create false

# Install dependencies
RUN poetry install --no-interaction --no-ansi --no-root

# Copy application code
COPY . .

# Install the package
RUN poetry install --no-interaction --no-ansi

# Create directory for temporary files
RUN mkdir -p /tmp

# Set environment variable for Python to run in unbuffered mode
ENV PYTHONUNBUFFERED=1

# Default command
ENTRYPOINT ["python3", "main.py"]
