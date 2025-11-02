@echo off
REM Nom de l'image Docker
SET IMAGE_NAME=mon-serveur-node

REM Nom du container
SET CONTAINER_NAME=serveur-node

REM Port à exposer
SET PORT=3000

echo Construction de l'image Docker...
docker build -t %IMAGE_NAME% .

if %ERRORLEVEL% EQU 0 (
    echo Image construite avec succes
    
    REM Arreter et supprimer le container existant s'il existe
    echo Nettoyage des containers existants...
    docker stop %CONTAINER_NAME% 2>nul
    docker rm %CONTAINER_NAME% 2>nul
    
    echo Lancement du container...
    docker run -d -p %PORT%:%PORT% --name %CONTAINER_NAME% %IMAGE_NAME%
    
    if %ERRORLEVEL% EQU 0 (
        echo Container lance avec succes
        echo Application disponible sur http://localhost:%PORT%
    ) else (
        echo Erreur lors du lancement du container
        exit /b 1
    )
) else (
    echo Erreur lors de la construction de l'image
    exit /b 1
)

pause