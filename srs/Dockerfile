FROM ossrs/srs:5

WORKDIR /usr/local/srs

COPY srs.conf.template /conf/srs.conf.template
COPY entrypoint.sh /entrypoint.sh

RUN sed -i 's/\r$//' /entrypoint.sh /conf/srs.conf.template && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
