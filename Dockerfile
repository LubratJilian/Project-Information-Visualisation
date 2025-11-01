# Utiliser une image Node.js officielle
FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les dossiers backend et frontend
COPY backend ./backend
COPY frontend ./frontend

# Installer les dépendances du backend
WORKDIR /app/backend
RUN npm install

# Installer les dépendances du frontend
WORKDIR /app/frontend
RUN npm install

# Retourner au répertoire principal
WORKDIR /app

# Exposer le port 3000
EXPOSE 3000

# Commande de démarrage (à adapter selon votre projet)
WORKDIR /app/backend
CMD ["node", "./index.js"]