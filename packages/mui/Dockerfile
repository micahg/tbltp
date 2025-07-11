FROM nginx:1.29.0

# Create app directory
RUN mkdir /var/www/
WORKDIR /var/www/

COPY build/ /var/www/
COPY public/github-mark.png /var/www/
COPY k8s/nginx-custom.conf /etc/nginx/conf.d/default.conf

CMD ["/bin/sh",  "-c",  "envsubst < /var/www/env.template.json > /var/www/env.json && envsubst < /var/www/auth.template.json > /var/www/auth.json && exec nginx -g 'daemon off;'"]
