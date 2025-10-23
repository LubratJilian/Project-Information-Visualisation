import pandas as pd
import json
import random
from shapely.geometry import shape, Point
from shapely.ops import unary_union
import numpy as np

def get_random_point_in_country(geometry, max_attempts=5000):
    """Génère un point aléatoire dans un pays avec plus de tentatives"""
    try:
        geom = shape(geometry)
        
        # Obtenir les limites du pays
        minx, miny, maxx, maxy = geom.bounds
        
        # Augmenter le nombre de tentatives pour éviter les centroïdes
        for _ in range(max_attempts):
            random_point = Point(
                random.uniform(minx, maxx),
                random.uniform(miny, maxy)
            )
            if geom.contains(random_point):
                return random_point.x, random_point.y
        
        # Si aucun point trouvé après max_attempts, utiliser une approche différente
        # Ajouter un décalage aléatoire au centroïde pour éviter les doublons
        centroid = geom.centroid
        offset_x = random.uniform(-0.5, 0.5)  # Décalage en degrés
        offset_y = random.uniform(-0.5, 0.5)
        
        # Vérifier que le point avec offset est toujours dans le pays
        offset_point = Point(centroid.x + offset_x, centroid.y + offset_y)
        if geom.contains(offset_point):
            return offset_point.x, offset_point.y
        print("centroid")
        # Dernier recours : centroïde avec petit décalage aléatoire
        return centroid.x + random.uniform(-0.1, 0.1), centroid.y + random.uniform(-0.1, 0.1)
    except Exception as e:
        print(f"Erreur pour la géométrie: {e}")
        return None, None

def generate_channel_coordinates(csv_file, geojson_file, output_file):
    """
    Génère un CSV avec channel_id, latitude, longitude
    
    Args:
        csv_file: Chemin vers le fichier CSV des chaînes
        geojson_file: Chemin vers le fichier GeoJSON des pays
        output_file: Chemin du fichier de sortie
    """
    
    # Charger le CSV des chaînes
    print(f"Chargement du CSV: {csv_file}")
    df_channels = pd.read_csv(csv_file)
    print(f"  → {len(df_channels)} chaînes trouvées")
    
    # Charger le GeoJSON
    print(f"\nChargement du GeoJSON: {geojson_file}")
    with open(geojson_file, 'r', encoding='utf-8') as f:
        geo_data = json.load(f)
    
    # Créer un dictionnaire des géométries par code pays
    country_geometries = {}
    for feature in geo_data['features']:
        iso_code = feature['properties'].get('ISO3166-1-Alpha-2')
        # Accepter tous les codes, même les chaînes vides
        if iso_code is not None:
            country_geometries[iso_code] = feature['geometry']
    
    print(f"  → {len(country_geometries)} pays trouvés dans le GeoJSON")
    
    # Générer les coordonnées pour chaque chaîne
    results = []
    channels_with_coords = 0
    channels_without_country = 0
    
    print(f"\nGénération des coordonnées...")
    for idx, row in df_channels.iterrows():
        channel_id = row['channel_id']
        country_code = row.get('country', '')

        if pd.isna(country_code):
            country_code = ''
        else:
            country_code = str(country_code).strip()

        if country_code not in country_geometries:
            print(country_code)
            channels_without_country += 1

            
            # Option 2: Mettre des coordonnées nulles
            results.append({
                'channel_id': channel_id,
                'channel_name': row.get('channel_name', ''),
                'country': country_code if not pd.isna(country_code) else '',
                'latitude': None,
                'longitude': None
            })
            continue
        
        # Générer un point aléatoire dans le pays
        lng, lat = get_random_point_in_country(country_geometries[country_code])
        
        if lng is not None and lat is not None:
            channels_with_coords += 1
            results.append({
                'channel_id': channel_id,
                'channel_name': row.get('channel_name', ''),
                'country': country_code,
                'latitude': lat,
                'longitude': lng
            })
        
        # Afficher la progression tous les 100 chaînes
        if (idx + 1) % 100 == 0:
            print(f"  Traité {idx + 1}/{len(df_channels)} chaînes...")
    
    # Créer le DataFrame de sortie
    df_output = pd.DataFrame(results)
    
    # Sauvegarder le CSV
    df_output.to_csv(output_file, index=False, encoding='utf-8')
    
    print(f"\n✅ Terminé !")
    print(f"  → {channels_with_coords} chaînes avec coordonnées")
    print(f"  → {channels_without_country} chaînes sans pays valide")
    print(f"  → Fichier généré: {output_file}")
    
    return df_output

# Exemple d'utilisation
if __name__ == "__main__":
    # Remplacez par vos chemins de fichiers
    CSV_FILE = "D:/Documents/Etudes/Polytech/2025-2026/SI5/Information Visualisation/Project-Information-Visualisation/frontend/data/youtube.csv"
    GEOJSON_FILE = "D:/Documents/Etudes/Polytech/2025-2026/SI5/Information Visualisation/Project-Information-Visualisation/frontend/Map/countries.geojson"
    OUTPUT_FILE = "./channels_with_coordinates.csv"
    
    try:
        df_result = generate_channel_coordinates(CSV_FILE, GEOJSON_FILE, OUTPUT_FILE)
        
        # Afficher un aperçu
        print("\n📊 Aperçu des résultats:")
        print(df_result.head(10))
        
        # Statistiques par pays
        print("\n📍 Répartition par pays:")
        country_counts = df_result[df_result['country'] != '']['country'].value_counts().head(10)
        print(country_counts)
        
    except FileNotFoundError as e:
        print(f"❌ Erreur: Fichier non trouvé - {e}")
    except Exception as e:
        print(f"❌ Erreur: {e}")