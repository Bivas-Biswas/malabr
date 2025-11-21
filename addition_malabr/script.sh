#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

# Variables (optional, for readability)
IMAGE_NAME="mycppserver"
CONTAINER_NAME="cpp-server-container"
HOST_DIR="/home/bivas_lappy/Desktop/malabr/src/addition_malabr"
UPLOADS_DIR="$HOST_DIR/uploads"
CONTAINER_UPLOADS_DIR="/app/uploads"
PORT_MAPPING="5000:5000"

# --------------------------
# Build the image
# --------------------------
podman build -t "$IMAGE_NAME" "$HOST_DIR"

# --------------------------
# Run the container
# --------------------------
podman run -d \
    -p "$PORT_MAPPING" \
    -v "$UPLOADS_DIR:$CONTAINER_UPLOADS_DIR:rw" \
    --name "$CONTAINER_NAME" \
    "$IMAGE_NAME"

echo "Container '$CONTAINER_NAME' running with image '$IMAGE_NAME'"