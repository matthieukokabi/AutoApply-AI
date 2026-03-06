# n8n Cloud Deployment Dockerfile
# Used for deploying n8n to Render, Railway, or other Docker-based platforms.
# Includes workflow and template files baked into the image.

FROM n8nio/n8n:latest

USER root

# Copy workflow files and templates into the container
COPY workflows/ /home/node/workflows/
COPY templates/ /home/node/templates/

# Ensure correct permissions
RUN chown -R node:node /home/node/workflows /home/node/templates

USER node

# n8n listens on port 5678
EXPOSE 5678

# Default entrypoint from base image handles startup
