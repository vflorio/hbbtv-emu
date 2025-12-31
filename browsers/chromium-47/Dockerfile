FROM debian:jessie

ENV DEBIAN_FRONTEND=noninteractive

# Debian Jessie is EOL, configure archive repositories
RUN echo "deb http://archive.debian.org/debian/ jessie main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://archive.debian.org/debian-security/ jessie/updates main contrib non-free" >> /etc/apt/sources.list && \
    echo "Acquire::Check-Valid-Until false;" > /etc/apt/apt.conf.d/99no-check-valid-until

# Install build dependencies for Chromium 47
RUN apt-get update && apt-get install -y --force-yes \
    # Core build tools
    build-essential \
    python \
    git \
    curl \
    file \
    lsb-release \
    sudo \
    pkg-config \
    # Chromium-specific dependencies
    bison \
    cdbs \
    dpkg-dev \
    elfutils \
    devscripts \
    fakeroot \
    flex \
    gperf \
    libasound2-dev \
    libbrlapi-dev \
    libbz2-dev \
    libcairo2-dev \
    libcap-dev \
    libcups2-dev \
    libcurl4-gnutls-dev \
    libdrm-dev \
    libelf-dev \
    libexif-dev \
    libgconf2-dev \
    libgl1-mesa-dev \
    libglib2.0-dev \
    libglu1-mesa-dev \
    libgnome-keyring-dev \
    libgtk2.0-dev \
    libkrb5-dev \
    libnspr4-dev \
    libnss3-dev \
    libpam0g-dev \
    libpci-dev \
    libpulse-dev \
    libsctp-dev \
    libspeechd-dev \
    libsqlite3-dev \
    libssl-dev \
    libudev-dev \
    libwww-perl \
    libxslt1-dev \
    libxss-dev \
    libxt-dev \
    libxtst-dev \
    patch \
    perl \
    python-crypto \
    python-dev \
    rpm \
    ruby \
    subversion \
    ttf-dejavu-core \
    wdiff \
    zip \
    xvfb \
    xauth \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for build
RUN useradd -m -s /bin/bash chromium && \
    echo "chromium ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set working directory
WORKDIR /home/chromium

# Install depot_tools at a version from December 2015 (Chromium 47 era)
USER chromium
RUN git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git && \
    cd depot_tools && \
    git checkout $(git rev-list -n 1 --before="2015-12-15" main) && \
    cd ..

# Add depot_tools to PATH and disable auto-update
ENV PATH="/home/chromium/depot_tools:${PATH}"
ENV DEPOT_TOOLS_UPDATE=0

# Configure git
RUN git config --global user.email "chromium@builder.local" && \
    git config --global user.name "Chromium Builder" && \
    git config --global color.ui false

# Copy container scripts
COPY --chown=chromium:chromium docker/entrypoint.sh /home/chromium/
COPY --chown=chromium:chromium docker/sync-chromium.sh /home/chromium/
COPY --chown=chromium:chromium docker/build-chromium.sh /home/chromium/
RUN chmod +x /home/chromium/*.sh

# Volume for chromium source
VOLUME ["/home/chromium"]

ENTRYPOINT ["/home/chromium/entrypoint.sh"]
CMD ["bash"]
