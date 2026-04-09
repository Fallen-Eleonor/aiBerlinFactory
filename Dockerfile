# Используем образ с Node и Python
FROM nikolaik/python-nodejs:python3.11-nodejs18

WORKDIR /app

# Копируем файлы проекта
COPY . .

# Устанавливаем зависимости Node
RUN npm install

# Создаем venv и устанавливаем зависимости Python ТУТ (на этапе сборки)
RUN cd apps/backend && \
    python3 -m venv .venv && \
    .venv/bin/pip install -e .[dev]

# Делаем скрипт исполняемым
RUN chmod +x ./scripts/dev.sh

# Запускаем
CMD ["bash", "./scripts/dev.sh"]