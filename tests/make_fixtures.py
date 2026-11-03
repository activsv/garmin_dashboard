#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère des fichiers FIT de test réalistes dans tests/fixtures/ avec l'encodeur
officiel Garmin (pip install garmin-fit-sdk). Ces fixtures complètent les vrais
fichiers .fit déposés à la racine du dépôt (branche main) :
  - activity_run.fit      : course à pied 30 min, 1 record/s (FC, cadence, distance, allure)
  - activity_ride_gps.fit : vélo 1 h avec trace GPS (positions lat/long) + puissance
  - monitoring_5days.fit  : 5 jours de monitoring (1 point / 2 min, 6 h -> 23 h) :
                            pas/distance/calories/temps actif CUMULATIFS (comme une
                            vraie montre), FC instantanée, stress_level
  - sleep_2nights.fit     : 2 nuits de sleep_level (profils profond/leger/REM/eveille)
  - bad.fit               : fichier corrompu (texte)
Usage : python3 tests/make_fixtures.py
"""
import math, os, random
from datetime import datetime, timedelta, timezone
from garmin_fit_sdk import Encoder, Profile

OUT = os.path.join(os.path.dirname(__file__), 'fixtures')
os.makedirs(OUT, exist_ok=True)
random.seed(42)
MN = Profile['mesg_num']

def fit(path, mesgs):
    enc = Encoder()
    for m in mesgs:
        enc.write_mesg(m)
    data = enc.close()
    with open(path, 'wb') as f:
        f.write(data)
    print('écrit', path, len(data), 'octets')

def file_id(ftype, created):
    return {'mesg_num': MN['FILE_ID'], 'type': ftype, 'manufacturer': 'garmin',
            'product': 3888, 'serial_number': 3504345514, 'time_created': created}

def activity_run():
    start = datetime(2026, 10, 20, 7, 0, tzinfo=timezone.utc)
    n = 1800  # 30 min à 1 record/s
    mesgs = [file_id('activity', start),
             {'mesg_num': MN['EVENT'], 'timestamp': start, 'event': 'timer', 'event_type': 'start'}]
    dist = 0.0
    for i in range(n):
        t = start + timedelta(seconds=i)
        hr = 120 + int(30 * math.sin(i / 90.0)) + random.randint(-2, 2)
        dist += 3.2  # ~11.5 km/h
        mesgs.append({'mesg_num': MN['RECORD'], 'timestamp': t,
                      'heart_rate': max(60, min(185, hr)), 'cadence': 82 + random.randint(-3, 3),
                      'distance': dist, 'speed': 3.2 + 0.3 * math.sin(i / 60.0),
                      'altitude': 120 + 20 * math.sin(i / 300.0), 'temperature': 18})
    end = start + timedelta(seconds=n)
    mesgs += [
        {'mesg_num': MN['LAP'], 'timestamp': end, 'start_time': start, 'sport': 'running',
         'total_elapsed_time': float(n), 'total_timer_time': float(n), 'total_distance': dist,
         'total_calories': 420, 'avg_heart_rate': 145, 'max_heart_rate': 172,
         'avg_speed': dist / n, 'max_speed': 3.6, 'avg_cadence': 82, 'total_ascent': 85, 'total_descent': 80},
        {'mesg_num': MN['SESSION'], 'timestamp': end, 'start_time': start, 'sport': 'running', 'sub_sport': 'street',
         'total_elapsed_time': float(n), 'total_timer_time': float(n), 'total_distance': dist,
         'total_calories': 420, 'avg_heart_rate': 145, 'max_heart_rate': 172,
         'avg_speed': dist / n, 'max_speed': 3.6, 'avg_cadence': 82, 'total_ascent': 85, 'total_descent': 80},
        {'mesg_num': MN['ACTIVITY'], 'timestamp': end, 'num_sessions': 1, 'type': 'manual',
         'total_timer_time': float(n), 'local_timestamp': end},
        {'mesg_num': MN['EVENT'], 'timestamp': end, 'event': 'timer', 'event_type': 'stop_all'},
    ]
    fit(os.path.join(OUT, 'activity_run.fit'), mesgs)

def activity_ride_gps():
    start = datetime(2026, 10, 22, 17, 30, tzinfo=timezone.utc)
    n = 720  # 1 h à 1 record / 5 s
    lat0, lon0 = 48.8566, 2.3522  # Paris
    mesgs = [file_id('activity', start),
             {'mesg_num': MN['EVENT'], 'timestamp': start, 'event': 'timer', 'event_type': 'start'}]
    dist = 0.0
    for i in range(n):
        t = start + timedelta(seconds=5 * i)
        ang = 2 * math.pi * i / n
        lat = lat0 + 0.01 * math.sin(ang)
        lon = lon0 + 0.015 * math.cos(ang) / max(0.5, math.cos(lat0 * math.pi / 180))
        spd = 8.0 + 2.5 * math.sin(i / 50.0)
        dist += spd * 5
        mesgs.append({'mesg_num': MN['RECORD'], 'timestamp': t,
                      'position_lat': lat, 'position_long': lon,
                      'heart_rate': 110 + int(25 * abs(math.sin(i / 80.0))), 'cadence': 90,
                      'distance': dist, 'speed': spd, 'power': 180 + int(60 * abs(math.sin(i / 40.0))),
                      'altitude': 35 + 5 * math.sin(i / 100.0)})
    end = start + timedelta(seconds=5 * n)
    mesgs += [
        {'mesg_num': MN['LAP'], 'timestamp': end, 'start_time': start, 'sport': 'cycling',
         'total_elapsed_time': 5.0 * n, 'total_timer_time': 5.0 * n, 'total_distance': dist,
         'total_calories': 650, 'avg_heart_rate': 132, 'max_heart_rate': 160, 'avg_speed': dist / (5 * n), 'max_speed': 10.5},
        {'mesg_num': MN['SESSION'], 'timestamp': end, 'start_time': start, 'sport': 'cycling', 'sub_sport': 'road',
         'total_elapsed_time': 5.0 * n, 'total_timer_time': 5.0 * n, 'total_distance': dist,
         'total_calories': 650, 'avg_heart_rate': 132, 'max_heart_rate': 160,
         'avg_speed': dist / (5 * n), 'max_speed': 10.5, 'total_ascent': 120, 'total_descent': 118},
        {'mesg_num': MN['ACTIVITY'], 'timestamp': end, 'num_sessions': 1, 'type': 'manual', 'total_timer_time': 5.0 * n},
        {'mesg_num': MN['EVENT'], 'timestamp': end, 'event': 'timer', 'event_type': 'stop_all'},
    ]
    fit(os.path.join(OUT, 'activity_ride_gps.fit'), mesgs)

def monitoring_5days():
    mesgs = []
    for day in range(25, 30):  # 2026-10-25 .. 2026-10-29
        d0 = datetime(2026, 10, day, 6, 0, tzinfo=timezone.utc)
        steps = 0; dist = 0.0; cal = 0; at = 0.0
        t = d0
        while t < d0.replace(hour=23):
            steps += random.randint(20, 60)          # cumulatif
            dist += random.uniform(15, 45)           # cumulatif (m)
            cal += random.randint(8, 20)             # cumulatif (kcal)
            at += 120.0                              # cumulatif (s)
            hr = 55 + int(25 * abs(math.sin((t - d0).total_seconds() / 5000.0))) + random.randint(-3, 3)
            mesgs.append({'mesg_num': MN['MONITORING'], 'timestamp': t,
                          'cycles': steps, 'distance': dist, 'calories': cal, 'active_time': at,
                          'heart_rate': hr})
            if random.random() < 0.3:
                mesgs.append({'mesg_num': MN['STRESS_LEVEL'],
                              'stress_level_time': t + timedelta(seconds=30),
                              'stress_level_value': random.randint(5, 90)})
            t += timedelta(minutes=2)
        mesgs.append({'mesg_num': MN['MONITORING_HR_DATA'], 'timestamp': d0.replace(hour=7),
                      'resting_heart_rate': 52, 'current_day_resting_heart_rate': 52 + day % 3})
    mesgs.insert(0, file_id('monitoring_b', datetime(2026, 10, 25, 6, 0, tzinfo=timezone.utc)))
    fit(os.path.join(OUT, 'monitoring_5days.fit'), mesgs)

def sleep_2nights():
    mesgs = [file_id('monitoring_b', datetime(2026, 10, 26, 23, 0, tzinfo=timezone.utc))]
    for night in (26, 27):
        t = datetime(2026, 10, night, 23, 0, tzinfo=timezone.utc)
        pattern = [1, 2, 2, 3, 3, 4, 2, 3, 4, 2] * 8
        for lvl in pattern:
            mesgs.append({'mesg_num': MN['SLEEP_LEVEL'], 'timestamp': t, 'sleep_level': lvl})
            t += timedelta(minutes=5)
    fit(os.path.join(OUT, 'sleep_2nights.fit'), mesgs)

def bad():
    with open(os.path.join(OUT, 'bad.fit'), 'w') as f:
        f.write('ceci n est pas un fichier FIT binaire\n')
    print('écrit', os.path.join(OUT, 'bad.fit'))

if __name__ == '__main__':
    activity_run()
    activity_ride_gps()
    monitoring_5days()
    sleep_2nights()
    bad()
