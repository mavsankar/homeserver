FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY app.js index.html styles.css /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8082
CMD ["nginx", "-g", "daemon off;"]
