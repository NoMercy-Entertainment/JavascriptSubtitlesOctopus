FROM docker.io/emscripten/emsdk:3.1.15

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        git \
        ragel \
        patch \
        libtool \
        itstool \
        pkg-config \
        python3 \
        python3-ply \
        gettext \
        autopoint \
        automake \
        autoconf \
        m4 \
        gperf \
        licensecheck \
        python3-pip \
        ninja-build \
        autoconf-archive \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir meson cmake

# fontconfig needs autoconf 2.71, the base image ships 2.69
RUN curl -fsSL https://ftp.gnu.org/gnu/autoconf/autoconf-2.72.tar.xz | tar -xJ -C /tmp \
    && cd /tmp/autoconf-2.72 && ./configure --prefix=/usr/local && make -j"$(nproc)" install \
    && rm -rf /tmp/autoconf-2.72

WORKDIR /code
CMD ["make"]
