FROM python:3.13-slim AS build
WORKDIR /app
COPY services/financial-analytics/requirements.txt requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt
FROM python:3.13-slim
RUN useradd --create-home --uid 10001 app
COPY --from=build /install /usr/local
WORKDIR /app
COPY --chown=app:app services/financial-analytics/app.py ./app.py
USER app
EXPOSE 8000
CMD ["python","-m","uvicorn","app:app","--host","0.0.0.0","--port","8000"]
