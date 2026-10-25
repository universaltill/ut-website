# ut-cms-relay: the Decap <-> GitHub OAuth relay for cms.universaltill.com,
# listening on 127.0.0.1:8081 behind nginx and oauth2-proxy.
#
# Until Phase 2 relay.js was a homelab-k8s ConfigMap run by the upstream node
# image. Azure Container Apps has no ConfigMaps, so it is baked in here instead
# (Phase 2 design card C4, ut-docs#4998).
#
# PUBLIC image from a PUBLIC repo. It carries one dependency-free stdlib file
# and the NON-secret config below. The GitHub OAuth client id/secret are read
# per request as FILES from SECRETS_DIR — a Key Vault secret volume on Azure,
# the CSI mount on the homelab — and never enter the image, a build arg or an
# ENV.
#
# Base image pinned to an exact tag AND digest; bump both together, and keep
# the major in step with node-version in .github/workflows/cms-images.yml.
FROM node:26.12.1-alpine3.24@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797

# relay.js needs only node itself: npm, npx, corepack and yarn have no use at
# run time, so they are removed from the running filesystem. (They remain in
# the base image's lower layer, so this does not shrink the image or silence a
# layer-by-layer scanner — it removes them from what the process can run.)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app
COPY relay.js /app/relay.js

# Fixed, not derived from any request header: SITE_ORIGIN is the origin the
# popup postMessages a GitHub token to. All four can be overridden by the app
# definition, but the image is correct for cms.universaltill.com as built.
ENV SITE_ORIGIN=https://cms.universaltill.com \
    PORT=8081 \
    NODE_ENV=production \
    SECRETS_DIR=/mnt/secrets-store

ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.title="ut-cms-relay" \
      org.opencontainers.image.description="Decap CMS GitHub OAuth relay for cms.universaltill.com"

# The official image's `node` user, numeric so runAsNonRoot can verify it.
USER 1000
ENTRYPOINT []
CMD ["node", "/app/relay.js"]
