FROM debian:jessie

ENV DEBIAN_FRONTEND=noninteractive

# Debian Jessie is EOL, configure archive repositories
RUN echo "deb http://archive.debian.org/debian/ jessie main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://archive.debian.org/debian-security/ jessie/updates main contrib non-free" >> /etc/apt/sources.list && \
    echo "Acquire::Check-Valid-Until false;" > /etc/apt/apt.conf.d/99no-check-valid-until

# Install build dependencies for WebKitGTK 2.2.6
RUN apt-get update && apt-get install -y --force-yes \
    build-essential \
    automake \
    autoconf \
    libtool \
    pkg-config \
    flex \
    bison \
    gperf \
    ruby \
    perl \
    python \
    libjpeg-dev \
    libpng12-dev \
    libwebp-dev \
    libxml2-dev \
    libxslt1-dev \
    libsqlite3-dev \
    libicu-dev \
    libglib2.0-dev \
    libgtk-3-dev \
    libgtk2.0-dev \
    libsoup2.4-dev \
    libsecret-1-dev \
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    libenchant-dev \
    libgudev-1.0-dev \
    gobject-introspection \
    libgirepository1.0-dev \
    libharfbuzz-dev \
    libfreetype6-dev \
    libfontconfig1-dev \
    libcairo2-dev \
    libxt-dev \
    libxrender-dev \
    libxcomposite-dev \
    libxdamage-dev \
    libgl1-mesa-dev \
    libegl1-mesa-dev \
    libgles2-mesa-dev \
    zlib1g-dev \
    libgeoclue-dev \
    libupower-glib-dev \
    libatk1.0-dev \
    gtk-doc-tools \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for build
RUN useradd -m -s /bin/bash webkit && \
    echo "webkit ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set working directory
WORKDIR /workspace

# Copy container scripts
COPY docker/entrypoint.sh /workspace/docker/
COPY docker/sync-webkit.sh /workspace/docker/
COPY docker/build-webkit.sh /workspace/docker/
RUN chmod +x /workspace/docker/*.sh

# Create build directory with proper permissions
RUN mkdir -p /workspace/build && chown -R webkit:webkit /workspace

USER webkit

# Volume for build artifacts
VOLUME ["/workspace/build"]

ENTRYPOINT ["/workspace/docker/entrypoint.sh"]
CMD ["bash"]
