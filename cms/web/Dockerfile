# ut-cms-web: the Decap CMS admin page + its nginx server block, served by an
# unprivileged nginx on 127.0.0.1:8080 behind oauth2-proxy (cms.universaltill.com).
#
# Until Phase 2 these two files were a homelab-k8s ConfigMap mounted into the
# upstream nginx image. Azure Container Apps has no ConfigMaps, so they are
# baked in here instead (Phase 2 design card C4, ut-docs#4998); the same image
# runs on the homelab or ACA unchanged.
#
# PUBLIC image from a PUBLIC repo: it holds the admin page (no secret — the
# GitHub token lives in the editor's browser, the client secret only in the
# relay's secret volume) and nginx config. Nothing is fetched at start-up.
#
# Runs as uid 101 and works with a read-only root filesystem as long as /tmp
# is writable: every path nginx writes (pid, temp dirs) points there.
# Base image pinned to an exact tag AND digest; bump both together.
FROM nginxinc/nginx-unprivileged:1.30.5-alpine3.24-slim@sha256:7f79f463c6eb0d0bf8782992bb9636434398e3e5848398805aef2c9b025d8609

# Our own nginx.conf + one server block. The image's default server and its
# entrypoint scripts (which rewrite conf files at start-up and would fail on a
# read-only root) are not used.
USER root
RUN rm -f /etc/nginx/conf.d/*.conf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
RUN chown -R root:root /usr/share/nginx/html /etc/nginx \
 && chmod -R a+rX,go-w /usr/share/nginx/html /etc/nginx

ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.title="ut-cms-web" \
      org.opencontainers.image.description="Decap CMS admin page for cms.universaltill.com (behind oauth2-proxy)"

USER 101
EXPOSE 8080
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
