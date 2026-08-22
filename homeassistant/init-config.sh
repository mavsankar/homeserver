#!/bin/sh
# Seed /config with defaults on first run (when volume is empty)

if [ ! -f /config/.initialized ]; then
    echo "First run detected — seeding /config with defaults..."
    cp -rf /default-config/* /config/
    touch /config/.initialized
fi

# Always ensure custom_components are up to date
cp -rf /default-config/custom_components /config/

# Always sync managed config files
cp -f /default-config/configuration.yaml /config/configuration.yaml
cp -f /default-config/automations.yaml /config/automations.yaml

# Ensure HA can write to config
chmod -R 777 /config
