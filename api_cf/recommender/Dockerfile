FROM python:3.10-slim

WORKDIR /app

COPY recommender/dependencies.txt .
RUN pip install --no-cache-dir -r dependencies.txt

COPY recommender ./recommender
COPY model_data ./model_data

EXPOSE 5000

ENV FLASK_DEBUG=0
ENV PYTHONUNBUFFERED=1

WORKDIR /app/recommender

CMD ["python", "app.py"]
