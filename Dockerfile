FROM composer:2 AS dependencies

WORKDIR /app/auth
COPY auth/composer.json auth/composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist

FROM php:8.3-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/php-app.htaccess /etc/apache2/timetable-php.conf
COPY index.php /var/www/html/index.php
COPY auth/*.php auth/.htaccess /var/www/html/auth/
COPY css/ /var/www/html/css/
COPY scripts/*.js /var/www/html/scripts/
COPY images/ /var/www/html/images/
COPY --from=dependencies /app/auth/vendor/ /var/www/html/auth/vendor/

EXPOSE 80
