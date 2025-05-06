#!/usr/bin/env python
"""
Simplified flight data generator for portfolio background.
1. Generate flight routes once at startup.
2. Send the complete route data to clients.
3. Client-side animation handles all movement.
"""
import asyncio
import json
import time
import math
import random
from datetime import datetime
import websockets

# Fixed bounding box for map display - expanded to cover more territory (North America/similar to first image)
# Using longitude, latitude format (x, y) this time
BBOX = (-101.0, 34.0, -79.0, 46.0)  # Central United States - expanded slightly for safety

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

def generate_flight_routes():
    """Generate synthetic flight routes for the map background with high density."""
    routes = []
    
    # Generate a much larger number of flights (similar to the first image)
    num_flights = 120  # Reduced from 250 to create more spacing between planes
    
    # Generate random points within the bounding box to serve as waypoints
    num_waypoints = 150
    waypoints = []
    
    # Make absolute sure the coordinates are in the right order: lon, lat
    lon_min, lat_min = BBOX[0], BBOX[1]  # Southwest corner
    lon_max, lat_max = BBOX[2], BBOX[3]  # Northeast corner
    
    print(f"[waypoints] Generating grid in region: lon {lon_min} to {lon_max}, lat {lat_min} to {lat_max}")
    
    # Generate a grid of waypoints with some randomization for more even distribution
    lat_step = (lat_max - lat_min) / 12
    lon_step = (lon_max - lon_min) / 12
    
    for i in range(13):
        for j in range(13):
            # Add some randomness to grid position
            lat = lat_min + i * lat_step + random.uniform(-lat_step/3, lat_step/3)
            lon = lon_min + j * lon_step + random.uniform(-lon_step/3, lon_step/3)
            
            # Keep within bounds
            lat = min(max(lat, lat_min), lat_max)
            lon = min(max(lon, lon_min), lon_max)
            
            waypoints.append({"lat": lat, "lon": lon})
    
    # Add some completely random waypoints too
    for _ in range(30):
        lat = random.uniform(lat_min, lat_max)
        lon = random.uniform(lon_min, lon_max)
        waypoints.append({"lat": lat, "lon": lon})
    
    print(f"[waypoints] Created {len(waypoints)} waypoints in region")
    
    # Airline codes for flight numbers - use US carriers for Central US
    airline_codes = ["AA", "UA", "DL", "WN", "NK", "B6", "AS", "F9", "G4", "HA", "SY"]
    
    # Create flight routes
    flight_ids = set()
    
    # Generate routes with randomized paths
    for _ in range(num_flights):
        # Pick random origin and destination
        while True:
            origin = random.choice(waypoints)
            destination = random.choice([w for w in waypoints if w != origin])
            
            # Calculate distance
            dx = destination["lon"] - origin["lon"]
            dy = destination["lat"] - origin["lat"]
            distance = math.sqrt(dx**2 + dy**2)
            
            # Ensure minimum distance for more meaningful flights
            if distance > (lon_max - lon_min) / 10:
                break
        
        # Create a unique flight ID
        airline_code = random.choice(airline_codes)
        flight_number = random.randint(100, 9999)
        flight_id = f"{airline_code}{flight_number}"
        
        while flight_id in flight_ids:
            flight_number = random.randint(100, 9999)
            flight_id = f"{airline_code}{flight_number}"
        
        flight_ids.add(flight_id)
        
        # Create a unique ICAO address
        icao = format(random.randint(0, 16777215), '06x')  # Random 24-bit hex
        
        # Create a control point for curved flight path
        origin_lat, origin_lon = origin["lat"], origin["lon"]
        dest_lat, dest_lon = destination["lat"], destination["lon"]
        
        # Calculate distance for scaling effects
        dx = dest_lon - origin_lon
        dy = dest_lat - origin_lat
        distance = math.sqrt(dx**2 + dy**2)
        
        # Create more varied flight paths with multiple control points
        num_control_points = random.randint(1, 3)  # Some flights have multiple bends
        
        # Generate path points
        path_points = []
        num_segments = num_control_points + 1
        
        # Generate control points
        control_points = []
        for i in range(num_control_points):
            # Progress along direct path
            t = (i + 1) / (num_control_points + 1)
            
            # Base position along direct path
            base_lat = origin_lat + (dest_lat - origin_lat) * t
            base_lon = origin_lon + (dest_lon - origin_lon) * t
            
            # Random perpendicular offset (smaller for more realistic paths)
            offset_factor = random.uniform(0.1, 0.3)
            perp_x = -dy * offset_factor
            perp_y = dx * offset_factor
            
            # Apply random direction
            if random.random() < 0.5:
                perp_x *= -1
                perp_y *= -1
            
            # Final control point
            ctrl_lat = base_lat + perp_y
            ctrl_lon = base_lon + perp_x
            
            control_points.append((ctrl_lat, ctrl_lon))
        
        # Calculate altitude (varied by distance but with randomization)
        base_altitude = random.uniform(30000, 40000)  # Base flight altitude in feet
        altitude = base_altitude / 3.28084  # Convert to meters for consistency
        
        # Generate path points with higher resolution
        num_points = min(100, max(50, int(distance * 30)))  # Adaptive based on distance
        
        # Use multiple Bezier curves to form the complete path
        current_segment = 0
        for i in range(num_points):
            # Calculate progress through the entire path
            t_overall = i / (num_points - 1)
            
            # Determine which segment this point belongs to
            segment_idx = min(int(t_overall * num_segments), num_segments - 1)
            
            # Calculate progress within this segment
            segment_length = 1 / num_segments
            t_segment = (t_overall - segment_idx * segment_length) / segment_length
            t_segment = max(0, min(1, t_segment))  # Clamp to [0,1]
            
            # Calculate position based on segment
            if segment_idx == 0:
                # First segment: origin to first control point
                if num_control_points > 0:
                    start_point = (origin_lat, origin_lon)
                    end_point = control_points[0]
                    lat = start_point[0] + (end_point[0] - start_point[0]) * t_segment
                    lon = start_point[1] + (end_point[1] - start_point[1]) * t_segment
                else:
                    # No control points, direct path
                    lat = origin_lat + (dest_lat - origin_lat) * t_overall
                    lon = origin_lon + (dest_lon - origin_lon) * t_overall
            elif segment_idx == num_segments - 1:
                # Last segment: last control point to destination
                if num_control_points > 0:
                    start_point = control_points[-1]
                    end_point = (dest_lat, dest_lon)
                    lat = start_point[0] + (end_point[0] - start_point[0]) * t_segment
                    lon = start_point[1] + (end_point[1] - start_point[1]) * t_segment
                else:
                    # No control points, direct path
                    lat = origin_lat + (dest_lat - origin_lat) * t_overall
                    lon = origin_lon + (dest_lon - origin_lon) * t_overall
            else:
                # Middle segment: between control points
                start_point = control_points[segment_idx - 1]
                end_point = control_points[segment_idx]
                lat = start_point[0] + (end_point[0] - start_point[0]) * t_segment
                lon = start_point[1] + (end_point[1] - start_point[1]) * t_segment
            
            # Calculate heading at this point
            # For simplicity, use linear interpolation between segments
            next_idx = min(i + 1, num_points - 1)
            if next_idx > i:
                next_t_overall = next_idx / (num_points - 1)
                next_segment_idx = min(int(next_t_overall * num_segments), num_segments - 1)
                next_t_segment = (next_t_overall - next_segment_idx * segment_length) / segment_length
                next_t_segment = max(0, min(1, next_t_segment))
                
                if next_segment_idx == 0:
                    if num_control_points > 0:
                        next_start = (origin_lat, origin_lon)
                        next_end = control_points[0]
                        next_lat = next_start[0] + (next_end[0] - next_start[0]) * next_t_segment
                        next_lon = next_start[1] + (next_end[1] - next_start[1]) * next_t_segment
                    else:
                        next_lat = origin_lat + (dest_lat - origin_lat) * next_t_overall
                        next_lon = origin_lon + (dest_lon - origin_lon) * next_t_overall
                elif next_segment_idx == num_segments - 1:
                    if num_control_points > 0:
                        next_start = control_points[-1]
                        next_end = (dest_lat, dest_lon)
                        next_lat = next_start[0] + (next_end[0] - next_start[0]) * next_t_segment
                        next_lon = next_start[1] + (next_end[1] - next_start[1]) * next_t_segment
                    else:
                        next_lat = origin_lat + (dest_lat - origin_lat) * next_t_overall
                        next_lon = origin_lon + (dest_lon - origin_lon) * next_t_overall
                else:
                    next_start = control_points[next_segment_idx - 1]
                    next_end = control_points[next_segment_idx]
                    next_lat = next_start[0] + (next_end[0] - next_start[0]) * next_t_segment
                    next_lon = next_start[1] + (next_end[1] - next_start[1]) * next_t_segment
                
                track = calculate_heading(lat, lon, next_lat, next_lon)
            else:
                # Last point, use previous heading
                track = path_points[-1]['track'] if path_points else 0
            
            # Calculate altitude profile
            if t_overall < 0.15:  # Takeoff phase
                alt_factor = t_overall / 0.15
            elif t_overall > 0.85:  # Landing phase
                alt_factor = (1 - t_overall) / 0.15
            else:  # Cruise phase
                alt_factor = 1.0
                
            # Add minor altitude variations during cruise
            if 0.15 <= t_overall <= 0.85:
                alt_factor += random.uniform(-0.05, 0.05)
                
            current_alt = altitude * alt_factor
            
            # Calculate speed (typically 400-500 knots cruise, slower during takeoff/landing)
            base_speed = random.uniform(180, 220)  # m/s (roughly 400-500 knots)
            if t_overall < 0.1:  # Takeoff
                speed_factor = 0.5 + (t_overall / 0.1) * 0.5
            elif t_overall > 0.9:  # Landing
                speed_factor = 0.5 + ((1 - t_overall) / 0.1) * 0.5
            else:  # Cruise with small variations
                speed_factor = 0.9 + random.uniform(0, 0.2)
                
            current_speed = base_speed * speed_factor
            
            # Add to path
            path_points.append({
                'lat': lat,
                'lon': lon,
                'track': track,
                'alt': current_alt,
                'speed': current_speed,
                'progress': t_overall
            })
        
        # Choose random city pairs for more interesting labels
        cities = [
            "Chicago", "New York", "Atlanta", "Houston", "Denver", "Toronto", 
            "Detroit", "Cleveland", "Indianapolis", "Minneapolis", "St. Louis", 
            "Kansas City", "Nashville", "Charlotte", "Pittsburgh", "Cincinnati",
            "Columbus", "Louisville", "Milwaukee", "Memphis", "Oklahoma City",
            "Buffalo", "Des Moines", "Omaha", "Wichita", "Tulsa", "Little Rock"
        ]
        
        origin_city = random.choice(cities)
        destination_city = random.choice([c for c in cities if c != origin_city])
        
        # Generate flight duration based on distance but with good variation
        duration = int(random.uniform(0.8, 1.2) * max(600, 300 + distance * 100))
        
        # Add complete route information
        routes.append({
            'icao': icao,
            'callsign': flight_id,
            'origin': origin_city,
            'destination': destination_city,
            'path': path_points,
            'duration': duration  # Flight duration in seconds
        })
    
    print(f"Generated {len(routes)} flight routes")
    return routes

async def ws_handler(websocket):
    """Send flight routes to clients just once at connection"""
    print("[ws] client connected")
    try:
        # Generate flight routes once per client connection
        routes = generate_flight_routes()
        
        # Send all route data to client
        payload = {
            "type": "routes",
            "timestamp": int(time.time()),
            "routes": routes
        }
        
        print(f"[ws] sending {len(routes)} flight routes")
        await websocket.send(json.dumps(payload))
        
        # Keep connection alive with a simple ping every 60 seconds
        while True:
            await asyncio.sleep(60)
            await websocket.send(json.dumps({"type": "ping"}))
            
    except Exception as e:
        print(f"[ws] error: {e}")

async def main():
    print("[main] starting high-density flight generator...")
    print(f"[main] map view region: {BBOX}")
    
    async with websockets.serve(ws_handler, "0.0.0.0", 8765):
        print("[main] websocket server running at ws://0.0.0.0:8765")
        while True:
            await asyncio.sleep(3600)  # Just keep server running

if __name__ == "__main__":
    asyncio.run(main())
