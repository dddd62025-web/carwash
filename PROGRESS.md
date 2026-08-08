# Progression — Évolution système de lavage

## Partie 1 — Base de données
- [x] Table `vehicle_type_config`
- [x] Table `wash_sessions`
- [x] Table `activations`
- [x] Table `karcher_lock`
- [x] Fonction RPC `request_activation`
- [x] Fonction RPC `end_activation`
- [x] Fonction RPC `heartbeat_activation`
- [x] Fonction RPC `expire_stuck_locks`
- [x] Fonction RPC `acknowledge_alert`
- [x] Politiques RLS (Lecture publique, Écritures sécurisées via RPC uniquement)

## Partie 2 — Interface Employé
- [x] Écran divisé en colonnes Poste 1 / Poste 2
- [x] Liste des véhicules autorisés pour le Poste 1 (Petite voiture)
- [x] Liste des véhicules autorisés pour le Poste 2 (Petite voiture, Grande voiture, Camion)
- [x] Bouton séparé + interface simplifiée pour le Poste 3 (Moto, Tapis, Tacha)
- [x] Affichage de l'état en temps réel du verrou Kärcher
- [x] Vérification : aucune alerte visible côté employé

## Partie 3 — Portail Gérant
- [x] Interface de configuration des temps par type de véhicule
- [x] Centre d'alertes avec badge de compteur en haut
- [x] Bouton d'acquittement ligne par ligne pour l'owner (job complété uniquement)
- [x] Filtres de période (Jour / Semaine / Mois / Jour spécifique) pour Voitures Lavées
- [x] Filtres de période pour l'Activité Récente
- [x] Affichage en rouge des lignes d'Activité Récente en alerte
- [x] Fenêtre modale de détails chronologiques des activations (au clic sur l'historique)
- [x] Second widget de chiffre d'affaires filtré par période
