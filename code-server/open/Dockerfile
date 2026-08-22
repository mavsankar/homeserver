FROM python:3.12-alpine

RUN apk add --no-cache git

WORKDIR /app
COPY app.py .

EXPOSE 8090

CMD ["python", "-u", "app.py"]
