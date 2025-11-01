#!/bin/bash

# Nom de l'image Docker
IMAGE_NAME="mon-serveur-node"

# Nom du container
CONTAINER_NAME="serveur-node"

# Port à exposer
PORT=3000

echo "Construction de l'image Docker..."
docker build -t $IMAGE_NAME .

if [ $? -eq 0 ]; then
    echo "Image construite avec succès"
    
    # Arrêter et supprimer le container existant s'il existe
    echo "Nettoyage des containers existants..."
    docker stop $CONTAINER_NAME 2>/dev/null
    docker rm $CONTAINER_NAME 2>/dev/null
    
    echo "Lancement du container..."
    docker run -d -p $PORT:$PORT --name $CONTAINER_NAME $IMAGE_NAME
    
    if [ $? -eq 0 ]; then
        echo "Container lancé avec succès"
        echo "Application disponible sur http://localhost:$PORT"
    else
        echo "Erreur lors du lancement du container"
        exit 1
    fi
else
    echo "Erreur lors de la construction de l'image"
    exit 1
fi