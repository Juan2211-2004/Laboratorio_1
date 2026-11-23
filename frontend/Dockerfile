FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY frontend/*.html frontend/*.css frontend/*.js /usr/share/nginx/html/

EXPOSE 80
