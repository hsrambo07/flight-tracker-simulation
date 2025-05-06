#!/usr/bin/env python
"""
Lightweight flight-data feed for one bounding-box.
1. Every 10 seconds we pull live OpenSky data.
2. We keep a sliding 30-min window, bucketed by second.
3. Latest frame is broadcast over a simple WebSocket.
"""
import asyncio
import json
import time
import math
import random
import requests
import pandas as pd
from datetime import datetime
from collections import defaultdict
import websockets

# New bounding box covering a busy region with more air traffic
# Western Europe: (lonmin, latmin, lonmax, latmax)
BBOX = (-5.0, 42.0, 15.0, 55.0)  # Updated to match the tightened map bounds in index.html
POLL_S = 5                                 # OpenSky poll period (reduced to 5 seconds for smoother updates)
WINDOW = 1800                              # seconds (30 min)

# time-bucketed store: ts -> [ {icao, lat, lon, track, alt, callsign} … ]
frames = defaultdict(list)

# Keep track of flight data between frames for better continuity
active_flights = {}  # icao -> latest data

# Helper function to calculate bezier curve points for curved flight paths
def bezier_point(p0, p1, p2, t):
    """Calculate point on a quadratic bezier curve at parameter t"""
    x = (1-t)**2 * p0[0] + 2*(1-t)*t * p1[0] + t**2 * p2[0]
    y = (1-t)**2 * p0[1] + 2*(1-t)*t * p1[1] + t**2 * p2[1]
    return (x, y)

# Calculate heading between two points (in degrees)
def calculate_heading(lat1, lon1, lat2, lon2):
    """Calculate the heading from point 1 to point 2"""
    dx = lon2 - lon1
    dy = lat2 - lat1
    return math.degrees(math.atan2(dx, dy)) % 360

# Demo flight data when API fails
def generate_demo_flights(timestamp):
    """Generate synthetic flight data for demo purposes."""
    flights = []
    
    # Major airports in Europe
    airports = [
        {"name": "LHR", "lat": 51.4700, "lon": -0.4543},  # London Heathrow
        {"name": "CDG", "lat": 49.0097, "lon": 2.5479},   # Paris Charles de Gaulle
        {"name": "AMS", "lat": 52.3105, "lon": 4.7683},   # Amsterdam Schiphol
        {"name": "FRA", "lat": 50.0379, "lon": 8.5622},   # Frankfurt
        {"name": "MAD", "lat": 40.4983, "lon": -3.5676},  # Madrid 
        {"name": "FCO", "lat": 41.8045, "lon": 12.2508},  # Rome Fiumicino
        {"name": "BCN", "lat": 41.2974, "lon": 2.0833},   # Barcelona
        {"name": "MUC", "lat": 48.3537, "lon": 11.7860},  # Munich
        {"name": "BRU", "lat": 50.9010, "lon": 4.4856},   # Brussels
        {"name": "ZRH", "lat": 47.4647, "lon": 8.5492},   # Zurich
    ]
    
    # Generate about 40-50 flights
    num_flights = 45 + random.randint(-5, 5)
    
    # Create a set of fixed flight routes
    routes = []
    
    # Create direct routes between all airports
    for i in range(len(airports)):
        for j in range(i+1, len(airports)):
            routes.append((airports[i], airports[j]))
    
    # Generate or update flights
    global active_flights
    
    # Initialize new flights if needed
    if not active_flights:
        flight_ids = set()
        for _ in range(num_flights):
            # Pick a random route
            origin, destination = random.choice(routes)
            
            # Create a unique flight ID
            airline_codes = ["BA", "AF", "LH", "IB", "AZ", "KL", "FR", "EZY", "RYR", "VLG"]
            flight_id = f"{random.choice(airline_codes)}{random.randint(100, 9999)}"
            
            if flight_id in flight_ids:
                continue
            flight_ids.add(flight_id)
            
            # Create a unique ICAO address
            icao = format(random.randint(0, 16777215), '06x')  # Random 24-bit hex
            
            # Generate random initial progress
            flight_duration = 15 * 60  # 15 minutes (reduced from 30 for faster flights)
            flight_progress = random.random()  # Random initial position
            
            # Create a control point for curved flight path
            # Randomize the control point to create varied curved paths
            origin_lat, origin_lon = origin["lat"], origin["lon"]
            dest_lat, dest_lon = destination["lat"], destination["lon"]
            
            # Midpoint
            mid_lat = (origin_lat + dest_lat) / 2
            mid_lon = (origin_lon + dest_lon) / 2
            
            # Add random offset to midpoint (perpendicular to direct path)
            dx = dest_lon - origin_lon
            dy = dest_lat - origin_lat
            path_length = math.sqrt(dx**2 + dy**2)
            
            # Create perpendicular offset
            offset_scale = random.uniform(0.1, 0.3) * path_length  # 10-30% of path length
            if random.random() < 0.5:  # Randomize direction of curve
                offset_scale *= -1
                
            # Calculate perpendicular vector
            perp_x = -dy
            perp_y = dx
            perp_length = math.sqrt(perp_x**2 + perp_y**2)
            
            # Normalize and scale
            if perp_length > 0:
                perp_x = (perp_x / perp_length) * offset_scale
                perp_y = (perp_y / perp_length) * offset_scale
            
            # Apply offset to midpoint
            control_lat = mid_lat + perp_y
            control_lon = mid_lon + perp_x
            
            # Flight phase and pattern information
            flight_phase = "cruise"  # cruise, approach, takeoff, or landing
            approach_pattern = None  # Will be set if in approach phase
            
            # Calculate current position using bezier curve
            p0 = (origin_lat, origin_lon)
            p1 = (control_lat, control_lon)
            p2 = (dest_lat, dest_lon)
            
            lat, lon = bezier_point(p0, p1, p2, flight_progress)
            
            # Calculate track at this point (tangent to the curve)
            # For bezier: calculate points slightly before and after, then find heading
            delta = 0.01
            prev_t = max(0, flight_progress - delta)
            next_t = min(1, flight_progress + delta)
            
            prev_lat, prev_lon = bezier_point(p0, p1, p2, prev_t)
            next_lat, next_lon = bezier_point(p0, p1, p2, next_t)
            track = calculate_heading(prev_lat, prev_lon, next_lat, next_lon)
            
            # Calculate altitude (cruise at about 10km, lower at take-off and landing)
            alt_profile = math.sin(flight_progress * math.pi)
            altitude = 10000 * alt_profile
            
            # Calculate speed (slower at takeoff/landing)
            speed = 250 * alt_profile
            
            # Store flight data
            active_flights[icao] = {
                'icao': icao,
                'callsign': flight_id,
                'lat': lat,
                'lon': lon,
                'track': track,
                'alt': altitude,
                'speed': speed,
                'origin': origin,
                'destination': destination,
                'progress': flight_progress,
                'flight_duration': flight_duration,
                'direction': 1,  # 1 = origin to dest, -1 = dest to origin
                'last_update': timestamp,
                'control_point': (control_lat, control_lon),
                'phase': flight_phase,
                'approach_pattern': approach_pattern
            }
    
    # Update existing flights
    for icao, flight in list(active_flights.items()):
        # Time since last update in seconds
        time_delta = timestamp - flight['last_update']
        
        # Update progress based on speed and time - accelerated by 1.5x
        progress_delta = (time_delta / flight['flight_duration']) * flight['direction'] * 1.5
        flight['progress'] += progress_delta
        
        # Check if we're approaching destination or origin
        progress = flight['progress']
        approach_threshold = 0.85  # When to start approach phase
        takeoff_threshold = 0.15   # When to end takeoff phase
        
        if flight['direction'] == 1 and progress > approach_threshold and flight['phase'] == 'cruise':
            # Start approach pattern when nearing destination
            flight['phase'] = 'approach'
            # Choose a random approach pattern (1-3 loops)
            flight['approach_pattern'] = {
                'loops': random.randint(1, 3),
                'current_loop': 0,
                'center': (flight['destination']['lat'], flight['destination']['lon']),
                'radius': random.uniform(0.05, 0.1),  # Degrees
                'start_angle': random.uniform(0, 360),
                'progress': 0  # Progress through the approach pattern (0-1)
            }
        elif flight['direction'] == -1 and progress < (1 - takeoff_threshold) and flight['phase'] == 'cruise':
            # Start approach pattern when nearing origin (flying backwards)
            flight['phase'] = 'approach'
            # Choose a random approach pattern (1-3 loops)
            flight['approach_pattern'] = {
                'loops': random.randint(1, 3),
                'current_loop': 0,
                'center': (flight['origin']['lat'], flight['origin']['lon']),
                'radius': random.uniform(0.05, 0.1),  # Degrees
                'start_angle': random.uniform(0, 360),
                'progress': 0  # Progress through the approach pattern (0-1)
            }
        
        # Calculate position based on flight phase
        if flight['phase'] == 'approach':
            # Update approach pattern progress
            pattern = flight['approach_pattern']
            pattern_speed = 0.01 * time_delta  # Slower for approach
            pattern['progress'] += pattern_speed
            
            if pattern['progress'] >= 1:
                pattern['current_loop'] += 1
                pattern['progress'] = 0
                
                if pattern['current_loop'] >= pattern['loops']:
                    # Approach complete, move to landing or takeoff
                    if flight['direction'] == 1:
                        # Change direction for the return trip
                        flight['progress'] = 1.0
                        flight['direction'] = -1
                        flight['phase'] = 'cruise'
                    else:
                        # Change direction for the outbound trip
                        flight['progress'] = 0.0
                        flight['direction'] = 1
                        flight['phase'] = 'cruise'
                    
                    # Reset approach pattern
                    flight['approach_pattern'] = None
            
            if flight['approach_pattern']:  # Check if still approaching
                # Calculate position in the approach pattern
                center_lat, center_lon = pattern['center']
                radius = pattern['radius']
                
                # Calculate angle based on progress through the approach
                angle = pattern['start_angle'] + (pattern['progress'] + pattern['current_loop']) * 360
                
                # Convert to radians
                angle_rad = math.radians(angle)
                
                # Calculate position
                flight['lat'] = center_lat + math.sin(angle_rad) * radius
                flight['lon'] = center_lon + math.cos(angle_rad) * radius
                
                # Calculate track (tangent to the circle)
                flight['track'] = (angle + 90) % 360
                
                # Lower altitude during approach
                if flight['direction'] == 1:
                    # Descending to land
                    alt_factor = 1 - pattern['progress']
                else:
                    # Climbing after takeoff
                    alt_factor = pattern['progress']
                
                flight['alt'] = 3000 * alt_factor
                flight['speed'] = 150 * alt_factor
        else:
            # Check if we've reached a destination
            if flight['progress'] >= 1.0:
                # Reached destination, prepare for approach
                flight['progress'] = 1.0
                flight['phase'] = 'cruise'  # Will become approach in next update
                flight['direction'] = -1
                
            elif flight['progress'] <= 0.0:
                # Reached origin, prepare for takeoff
                flight['progress'] = 0.0
                flight['phase'] = 'cruise'  # Will become takeoff in next update
                flight['direction'] = 1
            
            # Get current endpoints
            if flight['direction'] == 1:
                origin = flight['origin']
                destination = flight['destination']
            else:
                origin = flight['destination']
                destination = flight['origin']
            
            # Calculate current position using bezier curve
            p0 = (origin["lat"], origin["lon"])
            p1 = flight['control_point']
            p2 = (destination["lat"], destination["lon"])
            
            lat, lon = bezier_point(p0, p1, p2, flight['progress'])
            flight['lat'] = lat
            flight['lon'] = lon
            
            # Calculate track at this point (tangent to the curve)
            # For bezier: calculate points slightly before and after, then find heading
            delta = 0.01
            prev_t = max(0, flight['progress'] - delta)
            next_t = min(1, flight['progress'] + delta)
            
            prev_lat, prev_lon = bezier_point(p0, p1, p2, prev_t)
            next_lat, next_lon = bezier_point(p0, p1, p2, next_t)
            flight['track'] = calculate_heading(prev_lat, prev_lon, next_lat, next_lon)
            
            # Add some small random variation to path to make it more realistic
            flight['lat'] += random.uniform(-0.01, 0.01) * math.sin(timestamp / 1000)
            flight['lon'] += random.uniform(-0.01, 0.01) * math.sin(timestamp / 1200)
            
            # Calculate altitude (cruise at about 10km, lower at take-off and landing)
            if flight['direction'] == 1:
                # Outbound journey: takeoff -> cruise -> approach
                if flight['progress'] < 0.2:
                    # Takeoff (rapid climb)
                    alt_profile = flight['progress'] * 5  # 0 to 1 over 20% of journey
                elif flight['progress'] > 0.8:
                    # Beginning descent
                    alt_profile = (1 - flight['progress']) * 5  # 1 to 0 over final 20%
                else:
                    # Cruise at full altitude
                    alt_profile = 1.0
            else:
                # Return journey: approach -> cruise -> takeoff
                if flight['progress'] > 0.8:
                    # Takeoff (after turning around at destination)
                    alt_profile = (flight['progress'] - 0.8) * 5  # 0 to 1 over first 20%
                elif flight['progress'] < 0.2:
                    # Beginning descent to origin
                    alt_profile = flight['progress'] * 5  # 1 to 0 over final 20%
                else:
                    # Cruise at full altitude
                    alt_profile = 1.0
            
            flight['alt'] = 10000 * alt_profile
            
            # Calculate speed (slower at takeoff/landing)
            flight['speed'] = 250 * alt_profile
        
        # Update timestamp
        flight['last_update'] = timestamp
        
        # Add flight to current frame
        flights.append({
            'icao': flight['icao'],
            'callsign': flight['callsign'],
            'lat': flight['lat'],
            'lon': flight['lon'],
            'track': flight['track'],
            'alt': flight['alt'],
            'speed': flight['speed']
        })
    
    # Occasionally add or remove flights to simulate traffic changes
    if random.random() < 0.05:  # 5% chance each update
        if len(active_flights) > 30 and random.random() < 0.5:
            # Remove a random flight
            icao = random.choice(list(active_flights.keys()))
            del active_flights[icao]
        else:
            # Add a new flight
            origin, destination = random.choice(routes)
            
            # Create a unique flight ID
            airline_codes = ["BA", "AF", "LH", "IB", "AZ", "KL", "FR", "EZY", "RYR", "VLG"]
            flight_id = f"{random.choice(airline_codes)}{random.randint(100, 9999)}"
            
            # Create a unique ICAO address
            while True:
                icao = format(random.randint(0, 16777215), '06x')
                if icao not in active_flights:
                    break
            
            # Create a control point for curved flight path
            origin_lat, origin_lon = origin["lat"], origin["lon"]
            dest_lat, dest_lon = destination["lat"], destination["lon"]
            
            # Midpoint
            mid_lat = (origin_lat + dest_lat) / 2
            mid_lon = (origin_lon + dest_lon) / 2
            
            # Add random offset to midpoint (perpendicular to direct path)
            dx = dest_lon - origin_lon
            dy = dest_lat - origin_lat
            path_length = math.sqrt(dx**2 + dy**2)
            
            # Create perpendicular offset
            offset_scale = random.uniform(0.1, 0.3) * path_length
            if random.random() < 0.5:
                offset_scale *= -1
                
            # Calculate perpendicular vector
            perp_x = -dy
            perp_y = dx
            perp_length = math.sqrt(perp_x**2 + perp_y**2)
            
            # Normalize and scale
            if perp_length > 0:
                perp_x = (perp_x / perp_length) * offset_scale
                perp_y = (perp_y / perp_length) * offset_scale
            
            # Apply offset to midpoint
            control_lat = mid_lat + perp_y
            control_lon = mid_lon + perp_x
            
            # Starting at the origin
            flight_progress = 0.0
            lat, lon = origin["lat"], origin["lon"]
            
            # Calculate track
            track = calculate_heading(origin_lat, origin_lon, control_lat, control_lon)
            
            # Low altitude and speed at takeoff
            altitude = 100
            speed = 50
            
            # Store flight data
            active_flights[icao] = {
                'icao': icao,
                'callsign': flight_id,
                'lat': lat,
                'lon': lon,
                'track': track,
                'alt': altitude,
                'speed': speed,
                'origin': origin,
                'destination': destination,
                'control_point': (control_lat, control_lon),
                'progress': flight_progress,
                'flight_duration': 15 * 60,  # 15 minutes (reduced from 30)
                'direction': 1,
                'last_update': timestamp,
                'phase': 'cruise',
                'approach_pattern': None
            }
            
            # Add to current frame
            flights.append({
                'icao': icao,
                'callsign': flight_id,
                'lat': lat,
                'lon': lon,
                'track': track,
                'alt': altitude,
                'speed': speed
            })
    
    return flights


def prune():
    """Keep only the last 30 min in memory."""
    cutoff = int(time.time()) - WINDOW
    for ts in list(frames):
        if ts < cutoff:
            del frames[ts]


async def poll_opensky():
    api_failure_count = 0
    demo_mode = False
    
    while True:
        try:
            if not demo_mode:
                print("[poll] querying OpenSky", datetime.now())
                
                # Prepare API URL with bounding box
                south, north = BBOX[1], BBOX[3]  # latmin, latmax
                west, east = BBOX[0], BBOX[2]    # lonmin, lonmax
                
                url = f"https://opensky-network.org/api/states/all?lamin={south}&lomin={west}&lamax={north}&lomax={east}"
                print(f"[poll] requesting {url}")
                
                response = requests.get(url, timeout=30)
                print(f"[poll] received response: {response.status_code}")
                
                if response.status_code == 429:
                    api_failure_count += 1
                    if api_failure_count >= 3:
                        print("[poll] OpenSky API rate-limited. Switching to demo mode.")
                        demo_mode = True
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"[poll] data received: {data.keys()}")
                    api_failure_count = 0  # Reset counter on success
                    
                    if 'states' in data and data['states']:
                        # Create a DataFrame from the response
                        columns = ['icao24', 'callsign', 'origin_country', 'time_position', 
                                   'last_contact', 'longitude', 'latitude', 'geo_altitude', 
                                   'on_ground', 'velocity', 'track', 'vertical_rate', 
                                   'sensors', 'baro_altitude', 'squawk', 'spi', 'position_source']
                        
                        df = pd.DataFrame(data['states'], columns=columns)
                        print(f"[poll] received {len(df)} aircraft from OpenSky API")
                        
                        # Process into our format
                        now = int(time.time())
                        bucket = frames[now]
                        bucket.clear()
                        
                        for _, row in df.iterrows():
                            try:
                                # Only include rows with valid lat/lon
                                if row['latitude'] is None or row['longitude'] is None:
                                    continue
                                
                                # Clean the callsign - remove spaces and null values
                                callsign = row['callsign'].strip() if row['callsign'] else row['icao24']
                                
                                # Add to our frames
                                bucket.append({
                                    'icao': row['icao24'],
                                    'callsign': callsign,
                                    'lat': float(row['latitude']),
                                    'lon': float(row['longitude']),
                                    'track': float(row['track']) if row['track'] else 0,
                                    'alt': float(row['baro_altitude']) if row['baro_altitude'] else 0,
                                    'speed': float(row['velocity']) if row['velocity'] else 0
                                })
                            except Exception as e:
                                print(f"[poll] Error processing aircraft: {e}")
                        
                        print(f"[poll] stored {len(bucket)} aircraft @ {datetime.fromtimestamp(now)}")
                        print(f"[poll] total frames in memory: {len(frames)}")
                    else:
                        print("[poll] No aircraft states returned from OpenSky")
                else:
                    print(f"[poll] Error from OpenSky API: {response.status_code}")
            
            # Use demo data if API failed or we're in demo mode
            if demo_mode:
                now = int(time.time())
                print(f"[poll] Generating demo flight data @ {datetime.fromtimestamp(now)}")
                flights = generate_demo_flights(now)
                frames[now] = flights
                print(f"[poll] Generated {len(flights)} demo flights")
            
            # Always prune old data
            prune()
            
        except Exception as exc:
            print(f"[poll] error: {exc}")
            api_failure_count += 1
            
            # Switch to demo mode after 3 consecutive failures
            if api_failure_count >= 3 and not demo_mode:
                print("[poll] Switching to demo mode after repeated failures")
                demo_mode = True
        
        await asyncio.sleep(POLL_S)


async def ws_handler(websocket):
    """On connect: immediately stream all frames at once
    (the browser will drive playback speed). Then keep pushing
    fresh frames every POLL_S seconds."""
    print("[ws] client connected")
    while True:
        try:
            # compress frames into one message
            payload = {
                "type": "snapshot",
                "frames": [{"ts": ts, "flights": flights} for ts, flights in sorted(frames.items())]
            }
            flight_count = sum(len(f) for f in frames.values())
            print(f"[ws] sending {len(payload['frames'])} frames with {flight_count} total flight positions")
            await websocket.send(json.dumps(payload))
        except Exception as e:
            print(f"[ws] error: {e}")
            break
        await asyncio.sleep(POLL_S)


async def main():
    print("[main] starting server...")
    print(f"[main] tracking flights in bbox: {BBOX}")
    print(f"[main] keeping {WINDOW//60} minutes of flight history")
    print(f"[main] update interval: {POLL_S} seconds")
    
    # Start the demo immediately with simulated data
    now = int(time.time())
    print(f"[main] Generating initial demo flight data @ {datetime.fromtimestamp(now)}")
    flights = generate_demo_flights(now)
    frames[now] = flights
    print(f"[main] Generated {len(flights)} initial demo flights")
    
    async with websockets.serve(ws_handler, "0.0.0.0", 8765):
        print("[main] websocket server running at ws://0.0.0.0:8765")
        await poll_opensky()  # runs forever


if __name__ == "__main__":
    asyncio.run(main())
