# Use official Python slim image
FROM python:3.11-slim

# Disable bytecode generation & buffer output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Upgrade pip first
RUN pip install --upgrade pip

# Copy requirements first (better layer caching)
COPY app/requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY app/ .

# Create UNIX socket mount point
RUN mkdir -p /sockets

# Run the server
CMD ["python", "-u", "server.py"]