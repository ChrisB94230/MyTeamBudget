"""Seed presence data to test alerts."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from data_service import DataService

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
ds = DataService(DATA_DIR)

resources = ds.get_resources(2025)

for r in resources:
    if r.get('is_fictive'):
        continue
    rid = r['id']
    statut = r['statut']
    etp = float(r.get('etp', 1))
    nb_jours_total = float(r.get('nb_jours_total', 206 if statut == 'Interne' else 210))
    limite = nb_jours_total * etp

    for m in range(1, 6):
        jo = [22, 21, 21, 21, 19][m - 1]
        if rid == 10:
            worked = round(jo * etp, 2)
        elif rid == 8:
            worked = round(jo * etp * 0.95, 2)
        else:
            worked = round(jo * etp * 0.85, 2)

        ds.update_presence({
            'year': 2025,
            'month': m,
            'resource_id': rid,
            'jours_travailles': worked,
        })

print("Presence seed data created!")
print(f"Resources with presence data: {len([r for r in resources if not r.get('is_fictive')])}")
