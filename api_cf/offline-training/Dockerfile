# Use Python 3.9 slim image for minimal footprint
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the dependencies file and install Python dependencies
COPY dependencies.txt ./
RUN pip install --no-cache-dir -r dependencies.txt

# Copy all project files into the container
COPY . .

# Set the entrypoint: run the training script
CMD ["python", "train_cf_model.py"]
