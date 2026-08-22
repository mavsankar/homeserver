FROM ghcr.io/home-assistant/home-assistant:stable

# Pre-install HACS
RUN wget -O /tmp/hacs.zip "https://github.com/hacs/integration/releases/latest/download/hacs.zip" \
    && mkdir -p /default-config/custom_components/hacs \
    && unzip /tmp/hacs.zip -d /default-config/custom_components/hacs \
    && rm /tmp/hacs.zip

# Pre-install LG ThinQ integration
RUN wget -O /tmp/smartthinq.zip "https://github.com/ollo69/ha-smartthinq-sensors/releases/latest/download/smartthinq_sensors.zip" \
    && mkdir -p /default-config/custom_components/smartthinq_sensors \
    && unzip /tmp/smartthinq.zip -d /default-config/custom_components/smartthinq_sensors \
    && rm /tmp/smartthinq.zip

# Copy base configuration
COPY config/configuration.yaml /default-config/configuration.yaml
COPY config/automations.yaml /default-config/automations.yaml

# Init script: seed /config on first run
COPY init-config.sh /etc/cont-init.d/01-init-config.sh
RUN chmod +x /etc/cont-init.d/01-init-config.sh
