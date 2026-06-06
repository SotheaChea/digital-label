#!/bin/sh
set -e

echo "🚀 Starting Digital Label Backend..."

# Generate .env file from Render environment variables
cat > /app/.env << EOF
APP_NAME=DigitalLabel
APP_ENV=${APP_ENV:-production}
APP_KEY=${APP_KEY}
APP_DEBUG=${APP_DEBUG:-false}
APP_URL=${APP_URL:-http://localhost}

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=error

DB_CONNECTION=${DB_CONNECTION:-mysql}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-3306}
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
MYSQL_ATTR_SSL_CA=${MYSQL_ATTR_SSL_CA:-/app/ca.pem}

SESSION_DRIVER=${SESSION_DRIVER:-cookie}
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

CACHE_STORE=${CACHE_STORE:-array}
QUEUE_CONNECTION=database
FILESYSTEM_DISK=local
BROADCAST_CONNECTION=log

MAIL_MAILER=log
MAIL_FROM_ADDRESS="hello@digital-label.com"
MAIL_FROM_NAME="Digital Label"

IMAGEKIT_PUBLIC_KEY=${IMAGEKIT_PUBLIC_KEY:-public_FXQE7Qf2O0Y6i9/pnH88hh5CYAQ=}
IMAGEKIT_PRIVATE_KEY=${IMAGEKIT_PRIVATE_KEY:-private_Ii+7hweqISDbv9eWnIZlPaiVth0=}
IMAGEKIT_URL_ENDPOINT=${IMAGEKIT_URL_ENDPOINT:-https://ik.imagekit.io/steavnews}
EOF

echo "✅ .env file generated"

# Run database migrations
echo "📦 Running database migrations..."
php artisan migrate --force

# Cache config for performance
php artisan config:clear
php artisan config:cache
php artisan route:cache

echo "✅ Config cached"
echo "🌐 Starting server on port ${PORT:-8000}..."

# Start Laravel server
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
