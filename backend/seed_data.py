"""Seed script to populate sample data matching the Excel screenshots."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from data_service import DataService

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
ds = DataService(DATA_DIR)

resources_2025 = [
    {'name': 'Ressource 1', 'activite': 'TRANSV', 'tribu': '', 'statut': 'Interne', 'etp': 1, 'repartition_run': 0, 'nb_jours_total': 206, 'year': 2025,
     'jan': 17.17, 'feb': 17.17, 'mar': 17.17, 'apr': 17.17, 'may': 17.17, 'jun': 17.17, 'jul': 17.17, 'aug': 17.17, 'sep': 17.17, 'oct': 17.17, 'nov': 17.17, 'dec': 17.17},
    {'name': 'Ressource 2', 'activite': 'CBI/TBS', 'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
    {'name': 'Ressource 3', 'activite': 'DATA', 'tribu': '', 'statut': 'Externe', 'etp': 0.5, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 20.00, 'feb': 20.00, 'mar': 8.75, 'apr': 8.75, 'may': 8.75, 'jun': 8.75, 'jul': 8.75, 'aug': 8.75, 'sep': 8.75, 'oct': 8.75, 'nov': 8.75, 'dec': 8.75},
    {'name': 'Ressource 4', 'activite': 'STRAT', 'tribu': '', 'statut': 'Interne', 'etp': 1, 'repartition_run': 0, 'nb_jours_total': 206, 'year': 2025,
     'jan': 0, 'feb': 0, 'mar': 5.00, 'apr': 8.00, 'may': 8.00, 'jun': 17.17, 'jul': 17.17, 'aug': 17.17, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
    {'name': 'Ressource 5', 'activite': 'CBI/TBS', 'tribu': '', 'statut': 'Interne', 'etp': 0.5, 'repartition_run': 0.6, 'nb_jours_total': 206, 'year': 2025,
     'jan': 8.58, 'feb': 8.58, 'mar': 8.58, 'apr': 8.58, 'may': 8.58, 'jun': 0, 'jul': 0, 'aug': 0, 'sep': 0, 'oct': 0, 'nov': 0, 'dec': 0},
    {'name': 'Ressource 6', 'activite': 'CSI/FIT', 'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 0, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
    {'name': 'Ressource 7', 'activite': 'CYBER', 'tribu': '', 'statut': 'Interne', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 206, 'year': 2025,
     'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
    {'name': 'Ressource 8', 'activite': 'CLOUD', 'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
    {'name': 'Ressource 9', 'activite': 'CMI', 'tribu': '', 'statut': 'Interne', 'etp': 0.8, 'repartition_run': 0.6, 'nb_jours_total': 206, 'year': 2025,
     'jan': 13.73, 'feb': 13.73, 'mar': 13.73, 'apr': 13.73, 'may': 13.73, 'jun': 13.73, 'jul': 13.73, 'aug': 13.73, 'sep': 13.73, 'oct': 13.73, 'nov': 13.73, 'dec': 13.73},
    {'name': 'Ressource 10', 'activite': 'CYBER', 'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
    {'name': 'Ressource 11', 'activite': 'CSI/FIT', 'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 0, 'oct': 0, 'nov': 0, 'dec': 0},
    {'name': 'Ressource 12', 'activite': 'CYBER', 'tribu': '', 'statut': 'Interne', 'etp': 0.4, 'repartition_run': 0.6, 'nb_jours_total': 206, 'year': 2025,
     'jan': 6.87, 'feb': 6.87, 'mar': 6.87, 'apr': 0, 'may': 3.00, 'jun': 3.00, 'jul': 0, 'aug': 0, 'sep': 3.00, 'oct': 6.87, 'nov': 6.87, 'dec': 6.87},
    {'name': 'Ressource 13', 'activite': 'TRANSV', 'tribu': '', 'statut': 'Interne', 'etp': 0.8, 'repartition_run': 0, 'nb_jours_total': 206, 'year': 2025,
     'jan': 13.73, 'feb': 13.73, 'mar': 13.73, 'apr': 13.73, 'may': 13.73, 'jun': 13.73, 'jul': 13.73, 'aug': 13.73, 'sep': 13.73, 'oct': 13.73, 'nov': 13.73, 'dec': 13.73},
    {'name': 'Ressource 14', 'activite': 'DATA', 'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
    {'name': 'Ressource 15', 'activite': 'CLOUD', 'tribu': '', 'statut': 'Interne', 'etp': 0.4, 'repartition_run': 0.6, 'nb_jours_total': 206, 'year': 2025,
     'jan': 6.87, 'feb': 6.87, 'mar': 6.87, 'apr': 6.87, 'may': 6.87, 'jun': 6.87, 'jul': 6.87, 'aug': 6.87, 'sep': 6.87, 'oct': 6.87, 'nov': 6.87, 'dec': 6.87},
    {'name': 'Ressource 16', 'activite': 'CMI', 'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
    {'name': 'Ressource 17', 'activite': 'CLOUD', 'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
    {'name': 'Ressource 18', 'activite': 'CYBER', 'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025,
     'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 0, 'aug': 0, 'sep': 0, 'oct': 0, 'nov': 0, 'dec': 0},
]

# Add resources for Synthèse Graph data (2023, 2024)
synthese_2023 = {
    'jan': 183.25, 'feb': 158.25, 'mar': 132.75, 'apr': 96.25, 'may': 122.25,
    'jun': 139.25, 'jul': 98, 'aug': 140, 'sep': 171, 'oct': 187.75,
    'nov': 225.25, 'dec': 181.75
}
synthese_2024 = {
    'jan': 213.25, 'feb': 166.5, 'mar': 190.25, 'apr': 206.25, 'may': 187.25,
    'jun': 173.5, 'jul': 154.25, 'aug': 112.5, 'sep': 200.75, 'oct': 187.75,
    'nov': 175, 'dec': 174
}

# Aggregate 2023 as single "team" resource for comparison
ds.add_resource({
    'name': 'Equipe 2023', 'activite': 'TRANSV', 'tribu': '', 'statut': 'Interne',
    'etp': 1, 'repartition_run': 1, 'nb_jours_total': 1862, 'year': 2023,
    **synthese_2023
})

ds.add_resource({
    'name': 'Equipe 2024', 'activite': 'TRANSV', 'tribu': '', 'statut': 'Interne',
    'etp': 1, 'repartition_run': 1, 'nb_jours_total': 1863, 'year': 2024,
    **synthese_2024
})

for r in resources_2025:
    ds.add_resource(r)

# Add sample previsions
ds.add_prevision({
    'type': 'entree', 'name': 'Nouveau ETP Data', 'activite': 'DATA',
    'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8,
    'date_effet': '2025-07-01', 'motif': 'Renfort',
    'year': 2025, 'nb_jours_run': 0,
})

ds.add_prevision({
    'type': 'sortie', 'name': 'Fin contrat CSI/FIT', 'activite': 'CSI/FIT',
    'tribu': '', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8,
    'date_effet': '2025-09-30', 'motif': 'Fin de prestation',
    'year': 2025, 'nb_jours_run': 0,
})

# Add sample consumption (first 5 months of 2025)
for r in ds.get_resources(2025):
    for m in range(1, 6):
        month_key = ['jan', 'feb', 'mar', 'apr', 'may'][m-1]
        budget_val = r.get(month_key, 0)
        if budget_val > 0:
            consumed = round(budget_val * 0.95, 2)
            ds.update_consumption({
                'year': 2025, 'month': m, 'resource_id': r['id'], 'consumed': consumed
            })

print("Seed data created successfully!")
print(f"Resources: {len(ds.get_resources())}")
print(f"Previsions: {len(ds.get_previsions())}")
