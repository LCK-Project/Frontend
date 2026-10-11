FROM nginx:alpine
COPY . /usr/share/nginx/html/
# nginx 이미지는 기동 전에 /docker-entrypoint.d/*.sh 를 실행하므로 ENTRYPOINT 는 그대로 둔다
COPY docker-entrypoint.sh /docker-entrypoint.d/40-config-js.sh
RUN chmod +x /docker-entrypoint.d/40-config-js.sh
