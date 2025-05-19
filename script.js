// Map configuration variables
let MAP_WIDTH;
let MAP_HEIGHT;
const MAP_BOUNDS = {
  west: -100.0,
  east: -80.0,
  south: 35.0,
  north: 45.0
};

// Track animation state
let flightData = [];
let planeDivs = {};
let pathCanvases = {};
let animationRunning = false;
let recentFlights = []; // Store recent flight information for the sidebar

// Track pagination state
let currentPage = 0;
const flightsPerPage = 12; // Increased to better utilize scrolling

// Store sidebar state
let sidebarVisible = true;

// Initialize map dimensions based on current sidebar state
function initializeMapDimensions() {
  const sidebar = document.querySelector('.sidebar');
  let currentSidebarWidth = 280; // Default open width
  if (sidebar && sidebar.classList.contains('collapsed')) {
    currentSidebarWidth = 32; // Collapsed width
  }
  
  MAP_WIDTH = window.innerWidth - currentSidebarWidth;
  MAP_HEIGHT = window.innerHeight;
  
  console.log(`Map dimensions initialized: W=${MAP_WIDTH}, H=${MAP_HEIGHT}, SidebarW=${currentSidebarWidth}`);
}

// Add some static map features
function addMapFeatures() {
  // Ensure map dimensions are initialized
  initializeMapDimensions();
  
  const map = document.getElementById('flight-map');
  
  // Add state borders (simple dashed lines)
  const borders = [
    { lat: 41.5, label: "Iowa/Missouri Border" },
    { lat: 40.0, label: "Kansas/Nebraska Border" },
    { lat: 37.0, label: "Oklahoma/Kansas Border" }
  ];
  
  borders.forEach(border => {
    const y = convertLatToY(border.lat);
    const borderDiv = document.createElement('div');
    borderDiv.className = 'border';
    borderDiv.style.top = y + 'px';
    map.appendChild(borderDiv);
  });
  
  // Add city labels
  const cities = [
    { name: "Lincoln", lat: 40.8, lon: -96.7 },
    { name: "Omaha", lat: 41.3, lon: -96.0 },
    { name: "Kansas City", lat: 39.1, lon: -94.6 },
    { name: "Topeka", lat: 39.0, lon: -95.7 },
    { name: "North Platte", lat: 41.1, lon: -100.8 },
    { name: "Salina", lat: 38.8, lon: -97.6 },
    { name: "Saint Joseph", lat: 39.8, lon: -94.8 },
    { name: "Norfolk", lat: 42.0, lon: -97.4 }
  ];
  
  cities.forEach(city => {
    const x = convertLonToX(city.lon);
    const y = convertLatToY(city.lat);
    
    const cityDiv = document.createElement('div');
    cityDiv.className = 'map-feature';
    cityDiv.textContent = city.name;
    cityDiv.style.left = (x + 5) + 'px';
    cityDiv.style.top = y + 'px';
    map.appendChild(cityDiv);
  });
  
  // Add simple rivers (blue dots)
  const rivers = [
    { lat: 41.5, lon: -96.5, size: 15 },
    { lat: 39.5, lon: -95.0, size: 20 },
    { lat: 40.2, lon: -98.5, size: 12 },
    { lat: 38.0, lon: -97.0, size: 18 },
    { lat: 42.0, lon: -97.0, size: 15 },
    { lat: 39.0, lon: -96.0, size: 25 },
    { lat: 38.5, lon: -99.5, size: 15 },
    { lat: 41.2, lon: -95.8, size: 20 },
    { lat: 37.8, lon: -93.5, size: 15 }
  ];
  
  rivers.forEach(river => {
    const x = convertLonToX(river.lon);
    const y = convertLatToY(river.lat);
    
    const riverDiv = document.createElement('div');
    riverDiv.className = 'river';
    riverDiv.style.left = (x - river.size/2) + 'px';
    riverDiv.style.top = (y - river.size/2) + 'px';
    riverDiv.style.width = river.size + 'px';
    riverDiv.style.height = river.size + 'px';
    map.appendChild(riverDiv);
  });
  
  // Add "United States" label
  const usLabelDiv = document.createElement('div');
  usLabelDiv.className = 'map-feature';
  usLabelDiv.textContent = "Bangalore";
  usLabelDiv.style.left = (MAP_WIDTH / 2 - 40) + 'px';
  usLabelDiv.style.top = (MAP_HEIGHT / 2 + 50) + 'px';
  usLabelDiv.style.fontSize = '16px';
  usLabelDiv.style.color = '#999';
  map.appendChild(usLabelDiv);
  
  // Add airports (as landmarks)
  const airports = [
    { code: "MCI", name: "Kansas City Int'l", lat: 39.2976, lon: -94.7139 },
    { code: "STL", name: "St. Louis Lambert", lat: 38.7499, lon: -90.3748 },
    { code: "MSP", name: "Minneapolis–Saint Paul", lat: 44.8848, lon: -93.2223 },
    { code: "OMA", name: "Omaha Eppley", lat: 41.3032, lon: -95.8940 },
    { code: "DSM", name: "Des Moines Int'l", lat: 41.5340, lon: -93.6631 },
    { code: "CLE", name: "Cleveland Hopkins", lat: 41.4124, lon: -81.8498 },
    { code: "IND", name: "Indianapolis Int'l", lat: 39.7169, lon: -86.2956 },
    { code: "CMH", name: "Columbus John Glenn", lat: 39.9999, lon: -82.8872 },
    { code: "PIT", name: "Pittsburgh Int'l", lat: 40.4915, lon: -80.2329 },
    { code: "CVG", name: "Cincinnati/Northern Kentucky", lat: 39.0489, lon: -84.6678 },
    { code: "BNA", name: "Nashville Int'l", lat: 36.1263, lon: -86.6774 },
    { code: "MEM", name: "Memphis Int'l", lat: 35.0420, lon: -89.9792 },
    // Add airports outside the map bounds for flights entering/exiting the region
    { code: "ORD", name: "Chicago O'Hare", lat: 41.9742, lon: -87.9073 },
    { code: "DTW", name: "Detroit Metro", lat: 42.2162, lon: -83.3554 },
    { code: "DFW", name: "Dallas/Fort Worth", lat: 32.8998, lon: -97.0403 },
    { code: "DEN", name: "Denver Int'l", lat: 39.8561, lon: -104.6737 },
    { code: "IAH", name: "Houston George Bush", lat: 29.9902, lon: -95.3368 },
    { code: "ATL", name: "Atlanta Hartsfield-Jackson", lat: 33.6407, lon: -84.4277 }
  ];
  
  // Filter airports that are within the map bounds
  const visibleAirports = airports.filter(airport => {
    return airport.lon >= MAP_BOUNDS.west &&
           airport.lon <= MAP_BOUNDS.east &&
           airport.lat >= MAP_BOUNDS.south &&
           airport.lat <= MAP_BOUNDS.north;
  });
  
  visibleAirports.forEach(airport => {
    const x = convertLonToX(airport.lon);
    const y = convertLatToY(airport.lat);
    
    // Airport marker
    const airportDiv = document.createElement('div');
    airportDiv.className = 'airport';
    airportDiv.style.left = x + 'px';
    airportDiv.style.top = y + 'px';
    map.appendChild(airportDiv);
    
    // Airport label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'airport-label';
    labelDiv.textContent = airport.code;
    labelDiv.style.left = x + 'px';
    labelDiv.style.top = y + 'px';
    map.appendChild(labelDiv);
  });
}

// Convert latitude to Y coordinate
function convertLatToY(lat) {
  const latRange = MAP_BOUNDS.north - MAP_BOUNDS.south;
  const normalizedLat = (MAP_BOUNDS.north - lat) / latRange;
  return normalizedLat * MAP_HEIGHT;
}

// Convert longitude to X coordinate
function convertLonToX(lon) {
  const lonRange = MAP_BOUNDS.east - MAP_BOUNDS.west;
  const normalizedLon = (lon - MAP_BOUNDS.west) / lonRange;
  return normalizedLon * MAP_WIDTH;
}

// Convert coordinates to pixel positions
function coordsToPixels(lat, lon) {
  return {
    x: convertLonToX(lon),
    y: convertLatToY(lat)
  };
}

// Calculate heading: 0 is East (right), 90 is North (up), 180 is West (left), -90 is South (down)
function calculateHeading(startLat, startLon, endLat, endLon) {
  const startPixels = coordsToPixels(startLat, startLon);
  const endPixels = coordsToPixels(endLat, endLon);

  const dx = endPixels.x - startPixels.x;
  const dy = endPixels.y - startPixels.y; 

  // atan2(y,x) but for screen y is inverted for cartesian sense (dy is positive downwards)
  // To get a cartesian angle (0 East, 90 North), we use atan2(-dy, dx)
  let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
  return (angle + 360) % 360; // Normalize to 0-360 if needed, though atan2 is usually -180 to 180
}

// Create a flight with realistic curved paths
function createFlight(start, end, color, id, airline, flightNumber) {
  const pathPoints = [];
  const numPoints = 200; // Increase point density for smoother paths
  
  // Add some randomness to make each flight path unique
  const seedVal = id.charCodeAt(id.length - 1) % 10;
  const randomFactor = seedVal / 10; // 0.0-0.9
  
  // Calculate waypoints for a more realistic path
  // Most aircraft don't fly in perfectly straight lines - they follow waypoints
  const directDistance = Math.sqrt(
    Math.pow(end.lat - start.lat, 2) + 
    Math.pow(end.lon - start.lon, 2)
  );
  
  // Calculate the midpoint between start and end
  const midLat = (start.lat + end.lat) / 2;
  const midLon = (start.lon + end.lon) / 2;
  
  // Add some lateral deviation based on distance (longer flights curve more)
  const maxDeviation = directDistance * 0.15; // 15% of direct distance
  
  // Create 1-3 waypoints depending on distance
  const waypoints = [];
  
  // Always have a mid waypoint with some deviation
  const pathDeviation = (Math.random() * 2 - 1) * maxDeviation;
  
  // Perpendicular direction to create the curved path
  const perpLat = -(end.lon - start.lon) * pathDeviation / directDistance;
  const perpLon = (end.lat - start.lat) * pathDeviation / directDistance;
  
  waypoints.push({
    lat: midLat + perpLat,
    lon: midLon + perpLon
  });
  
  // For longer flights, add more waypoints
  if (directDistance > 5) {
    const quarter = {
      lat: start.lat + (end.lat - start.lat) * 0.25 + perpLat * 0.6,
      lon: start.lon + (end.lon - start.lon) * 0.25 + perpLon * 0.6
    };
    
    const threeQuarter = {
      lat: start.lat + (end.lat - start.lat) * 0.75 + perpLat * 0.6,
      lon: start.lon + (end.lon - start.lon) * 0.75 + perpLon * 0.6
    };
    
    waypoints.unshift(quarter);
    waypoints.push(threeQuarter);
  }
  
  // Add start point
  waypoints.unshift({lat: start.lat, lon: start.lon});
  
  // Add end point
  waypoints.push({lat: end.lat, lon: end.lon});
  
  // Now create path points by interpolating between waypoints with bezier curves
  for (let i = 0; i < waypoints.length - 1; i++) {
    const startWP = waypoints[i];
    const endWP = waypoints[i+1];
    
    const pointsForSegment = Math.floor(numPoints / (waypoints.length - 1));
    
    for (let j = 0; j < pointsForSegment; j++) {
      const t = j / pointsForSegment;
      
      let lat, lon;
      
      // Use cubic bezier for smoother transitions between waypoints
      if (i > 0 && i < waypoints.length - 2) {
        // Get control points for bezier curve
        const prevWP = waypoints[i-1];
        const nextWP = waypoints[i+2 > waypoints.length-1 ? waypoints.length-1 : i+2];
        
        const cp1 = {
          lat: startWP.lat + (endWP.lat - prevWP.lat) * 0.2,
          lon: startWP.lon + (endWP.lon - prevWP.lon) * 0.2
        };
        
        const cp2 = {
          lat: endWP.lat - (nextWP.lat - startWP.lat) * 0.2,
          lon: endWP.lon - (nextWP.lon - startWP.lon) * 0.2
        };
        
        // Cubic bezier interpolation
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        
        lat = mt3 * startWP.lat + 3 * mt2 * t * cp1.lat + 3 * mt * t2 * cp2.lat + t3 * endWP.lat;
        lon = mt3 * startWP.lon + 3 * mt2 * t * cp1.lon + 3 * mt * t2 * cp2.lon + t3 * endWP.lon;
      } else {
        // Simple linear interpolation for first and last segments
        lat = startWP.lat + (endWP.lat - startWP.lat) * t;
        lon = startWP.lon + (endWP.lon - startWP.lon) * t;
      }
      
      // Add some minuscule variations for more realistic path
      // Actual flights never fly in perfect lines even between waypoints due to wind, etc.
      const microVariation = Math.sin(t * Math.PI * 6 + seedVal) * 0.0005;
      lat += microVariation;
      lon += microVariation;
      
      pathPoints.push({ lat, lon });
    }
  }
  
  // Ensure the exact end point is included
  pathPoints.push({ lat: end.lat, lon: end.lon });
  
  // Calculate realistic initial progress (small randomization)
  const progress = Math.random() * 0.1; // Start within first 10% of route
  
  // Determine cardinal direction based on overall heading
  const overallHeading = calculateHeading(start.lat, start.lon, end.lat, end.lon);
  let direction;
  
  if (overallHeading >= 315 || overallHeading < 45) direction = 'Eastbound';
  else if (overallHeading >= 45 && overallHeading < 135) direction = 'Northbound';
  else if (overallHeading >= 135 && overallHeading < 225) direction = 'Westbound';
  else direction = 'Southbound';
  
  return {
    id,
    callsign: `${airline}${flightNumber}`,
    origin: start.code,
    destination: end.code,
    path: pathPoints,
    color,
    progress: progress, 
    direction: direction,
    actualStartTime: Date.now() + Math.random() * 60000, // Randomize start times
    plannedDuration: 300000 + Math.random() * 300000, // 5-10 minutes flight time
    // Add turbulence factor that will affect movement
    turbulence: Math.random() * 0.2,
    // Weather and wind conditions (can affect speed and heading)
    windFactor: (Math.random() * 0.4) - 0.2, // -0.2 to +0.2 (headwind/tailwind)
    // Create a seed for this flight to make its behavior deterministic yet unique
    seed: seedVal
  };
}

// Generate flight data with more natural paths
function generateFlights() {
  const flights = [];
  const airlines = ['AA', 'UA', 'DL', 'WN', 'F9', 'AS', 'NK', 'B6'];

  const majorHubs = [
    { code: "ORD", name: "Chicago O'Hare", lat: 41.9742, lon: -87.9073 },
    { code: "ATL", name: "Atlanta Hartsfield-Jackson", lat: 33.6407, lon: -84.4277 },
    { code: "DFW", name: "Dallas/Fort Worth", lat: 32.8998, lon: -97.0403 },
    { code: "DEN", name: "Denver Int'l", lat: 39.8561, lon: -104.6737 },
    { code: "LAX", name: "Los Angeles", lat: 33.9416, lon: -118.4085 }, 
    { code: "JFK", name: "New York JFK", lat: 40.6413, lon: -73.7781 } 
  ];

  const regionalAirports = [
    { code: "MCI", name: "Kansas City", lat: 39.3, lon: -94.7 },
    { code: "STL", name: "St. Louis", lat: 38.7, lon: -90.4 },
    { code: "OMA", name: "Omaha", lat: 41.3, lon: -96.0 },
    { code: "DSM", name: "Des Moines", lat: 41.5, lon: -93.7 },
    { code: "MSP", name: "Minneapolis", lat: 44.9, lon: -93.2 },
    { code: "CMH", name: "Columbus", lat: 40.0, lon: -82.9 },
    { code: "IND", name: "Indianapolis", lat: 39.7, lon: -86.3 },
    { code: "CVG", name: "Cincinnati", lat: 39.0, lon: -84.7 },
    { code: "MEM", name: "Memphis", lat: 35.0, lon: -90.0 },
    { code: "BNA", name: "Nashville", lat: 36.1263, lon: -86.6774 },
    { code: "CLE", name: "Cleveland", lat: 41.4124, lon: -81.8498 },
    { code: "PIT", name: "Pittsburgh", lat: 40.4915, lon: -80.2329 },
  ];

  const edgePoints = [
    { code: "EDGE_NW", name: "Edge NW", lat: MAP_BOUNDS.north + 2, lon: MAP_BOUNDS.west - 2 },
    { code: "EDGE_NE", name: "Edge NE", lat: MAP_BOUNDS.north + 2, lon: MAP_BOUNDS.east + 2 },
    { code: "EDGE_SW", name: "Edge SW", lat: MAP_BOUNDS.south - 2, lon: MAP_BOUNDS.west - 2 },
    { code: "EDGE_SE", name: "Edge SE", lat: MAP_BOUNDS.south - 2, lon: MAP_BOUNDS.east + 2 },
    { code: "EDGE_N", name: "Edge N", lat: MAP_BOUNDS.north + 3, lon: (MAP_BOUNDS.west + MAP_BOUNDS.east) / 2 },
    { code: "EDGE_S", name: "Edge S", lat: MAP_BOUNDS.south - 3, lon: (MAP_BOUNDS.west + MAP_BOUNDS.east) / 2 },
    { code: "EDGE_E", name: "Edge E", lat: (MAP_BOUNDS.north + MAP_BOUNDS.south) / 2, lon: MAP_BOUNDS.east + 3 },
    { code: "EDGE_W", name: "Edge W", lat: (MAP_BOUNDS.north + MAP_BOUNDS.south) / 2, lon: MAP_BOUNDS.west - 3 },
  ];

  const allDestinations = [...majorHubs, ...regionalAirports];
  let flightIdCounter = 0;

  const numHubToHub = 20; // Increased
  for (let i = 0; i < numHubToHub; i++) {
    let origin = majorHubs[Math.floor(Math.random() * majorHubs.length)];
    let destination;
    do {
      destination = majorHubs[Math.floor(Math.random() * majorHubs.length)];
    } while (destination.code === origin.code);
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNumber = Math.floor(Math.random() * 9000) + 1000;
    // Use random initial flight progress
    const initialProgress = getRandomFlightProgress();
    const flight = createFlight(origin, destination, getRandomColor(flightIdCounter), `flight-${flightIdCounter++}`, airline, flightNumber);
    flight.progress = initialProgress;
    flight.actualStartTime = Date.now() - (initialProgress * flight.plannedDuration);
    flights.push(flight);
  }

  const numHubSpoke = 35; // Increased
  for (let i = 0; i < numHubSpoke; i++) {
    let origin, destination;
    if (Math.random() < 0.5) { 
      origin = majorHubs[Math.floor(Math.random() * majorHubs.length)];
      destination = [...regionalAirports, ...edgePoints][Math.floor(Math.random() * (regionalAirports.length + edgePoints.length))];
    } else { 
      origin = [...regionalAirports, ...edgePoints][Math.floor(Math.random() * (regionalAirports.length + edgePoints.length))];
      destination = majorHubs[Math.floor(Math.random() * majorHubs.length)];
    }
    if (origin.code === destination.code) continue; 
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNumber = Math.floor(Math.random() * 9000) + 1000;
    // Use random initial flight progress
    const initialProgress = getRandomFlightProgress();
    const flight = createFlight(origin, destination, getRandomColor(flightIdCounter), `flight-${flightIdCounter++}`, airline, flightNumber);
    flight.progress = initialProgress;
    flight.actualStartTime = Date.now() - (initialProgress * flight.plannedDuration);
    flights.push(flight);
  }
  
  const numRegionalToRegional = 25; // Increased
  for (let i = 0; i < numRegionalToRegional; i++) {
    let origin = regionalAirports[Math.floor(Math.random() * regionalAirports.length)];
    let destination;
    do {
      destination = regionalAirports[Math.floor(Math.random() * regionalAirports.length)];
    } while (destination.code === origin.code);
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNumber = Math.floor(Math.random() * 9000) + 1000;
    // Use random initial flight progress
    const initialProgress = getRandomFlightProgress();
    const flight = createFlight(origin, destination, getRandomColor(flightIdCounter), `flight-${flightIdCounter++}`, airline, flightNumber);
    flight.progress = initialProgress;
    flight.actualStartTime = Date.now() - (initialProgress * flight.plannedDuration);
    flights.push(flight);
  }
  
  const numEdgeIncoming = 20; // Increased
  for (let i = 0; i < numEdgeIncoming; i++) {
    let origin = edgePoints[Math.floor(Math.random() * edgePoints.length)];
    let destination = allDestinations[Math.floor(Math.random() * allDestinations.length)];
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNumber = Math.floor(Math.random() * 9000) + 1000;
    // Use random initial flight progress
    const initialProgress = getRandomFlightProgress();
    const flight = createFlight(origin, destination, getRandomColor(flightIdCounter), `flight-${flightIdCounter++}`, airline, flightNumber);
    flight.progress = initialProgress;
    flight.actualStartTime = Date.now() - (initialProgress * flight.plannedDuration);
    flights.push(flight);
  }

  const numEdgeOutgoing = 20; // Increased
  for (let i = 0; i < numEdgeOutgoing; i++) {
    let origin = allDestinations[Math.floor(Math.random() * allDestinations.length)];
    let destination = edgePoints[Math.floor(Math.random() * edgePoints.length)];
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNumber = Math.floor(Math.random() * 9000) + 1000;
    // Use random initial flight progress
    const initialProgress = getRandomFlightProgress();
    const flight = createFlight(origin, destination, getRandomColor(flightIdCounter), `flight-${flightIdCounter++}`, airline, flightNumber);
    flight.progress = initialProgress;
    flight.actualStartTime = Date.now() - (initialProgress * flight.plannedDuration);
    flights.push(flight);
  }
  
  console.log(`Generated ${flights.length} flights.`);
  return flights;
}

// Get a random initial flight progress based on a realistic distribution
function getRandomFlightProgress() {
  const rand = Math.random();
  
  // 30% chance of being at airport/early climb (0-15%)
  if (rand < 0.3) {
    return Math.random() * 0.15;
  }
  // 50% chance of being in cruise phase (15-85%)
  else if (rand < 0.8) {
    return 0.15 + Math.random() * 0.7;
  }
  // 20% chance of being in descent/landing (85-100%)
  else {
    return 0.85 + Math.random() * 0.15;
  }
}

// Get a random pastel color
function hexToRgba(hex, alpha = 0.5) {
  // strip leading "#" and expand shorthand (#abc → #aabbcc)
  const h = hex.replace('#', '');
  const bigint = h.length === 3
    ? parseInt(h.split('').map(c => c + c).join(''), 16)
    : parseInt(h, 16);

  const r = (bigint >> 16) & 255;
  const g = (bigint >>  8) & 255;
  const b =  bigint        & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRandomColor(index, alpha = 0.5) {
  const accessibleColors = [
    '#0072B2', // blue
    '#E69F00', // orange
    '#009E73', // green
    '#CC79A7', // magenta
    '#56B4E9', // sky blue
    '#D55E00', // red-orange
    '#F0E442', // yellow
    '#6d2dac'  // deep purple
  ];
  return hexToRgba(accessibleColors[index % accessibleColors.length], alpha);
}

// Create a plane element
function createPlane(flight) {
  const map = document.getElementById('flight-map');
  const plane = document.createElement('div');
  plane.id = flight.id;
  plane.className = 'plane';
  plane.textContent = '*'; 
  
  plane.dataset.callsign = flight.callsign;
  plane.dataset.origin = flight.origin;
  plane.dataset.destination = flight.destination;
  
  const initialPoint = flight.path[0];
  let initialAngle = 0;
  if (flight.path.length > 1) {
    const secondPoint = flight.path[1];
    initialAngle = calculateHeading(initialPoint.lat, initialPoint.lon, secondPoint.lat, secondPoint.lon);
  }
  
  // Apply a -90 degree offset because the asterisk '*' visually points up by default
  // Our calculateHeading now gives 0 for East. To make asterisk point East, rotate -90 deg.
  plane.style.transform = `translate(-50%, -50%) rotate(${initialAngle - 90}deg)`;
  
  const pixelPos = coordsToPixels(initialPoint.lat, initialPoint.lon);
  plane.style.left = pixelPos.x + 'px';
  plane.style.top = pixelPos.y + 'px';
  
  plane.addEventListener('mouseenter', showTooltip);
  plane.addEventListener('mouseleave', hideTooltip);
  
  // Add click event to highlight the plane and its flight card
  plane.addEventListener('click', function(event) {
    event.stopPropagation(); // Prevent map click from clearing selection
    
    // Clear all existing highlights
    clearAllHighlights();
    
    // Highlight this plane
    plane.classList.add('highlighted');
    
    // Create pulsing highlight effect
    createPulsingHighlight(plane);
    
    // Find and highlight the corresponding flight card
    const flightCard = document.getElementById(`card-${flight.id}`);
    if (flightCard) {
      flightCard.classList.add('selected');
      flightCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
  
  map.appendChild(plane);
  return plane;
}

// Create a canvas for drawing the flight path
function createPathCanvas(flight) {
  const map = document.getElementById('flight-map');
  
  // Create canvas for the flight path
  const canvas = document.createElement('canvas');
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  canvas.className = 'path';
  canvas.id = `path-${flight.id}`;
  
  map.appendChild(canvas);
  return canvas;
}

// Draw the flight path with trailing effect
function drawFlightPath(canvas, flight, progress) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Calculate the visible portion of the path (trailing effect)
  const trailLength = 0.24; // How much of the path to show behind the plane
  const startProgress = Math.max(0, progress - trailLength);
  
  // Find the start and end indices in the path array
  const startIdx = Math.floor(startProgress * (flight.path.length - 1));
  const endIdx = Math.floor(progress * (flight.path.length - 1));
  
  if (endIdx <= startIdx) return;
  
  // Draw the path with improved visibility
  ctx.beginPath();
  ctx.strokeStyle = flight.color;
  ctx.lineWidth = 2.0; // Increased thickness for better visibility
  ctx.setLineDash([4, 8]); // More visible dot spacing
  
  // Start point
  const startPoint = flight.path[startIdx];
  const startPixels = coordsToPixels(startPoint.lat, startPoint.lon);
  ctx.moveTo(startPixels.x, startPixels.y);
  
  // Draw line through all points in between
  for (let i = startIdx + 1; i <= endIdx; i++) {
    const point = flight.path[i];
    const pixels = coordsToPixels(point.lat, point.lon);
    ctx.lineTo(pixels.x, pixels.y);
  }
  
  ctx.stroke();
}

// Create a flight card in the sidebar with more realistic data
function createFlightCard(flight, flightInfo) {
  const { altitude, groundSpeed, heading, verticalSpeed, turbulence } = flightInfo;
  
  const card = document.createElement('div');
  card.className = 'flight-card';
  card.id = `card-${flight.id}`;
  
  // Get the color for the left border (without alpha transparency)
  const solidColor = flight.color.replace('rgba', 'rgb').replace(/, [0-9.]+\)/, ')');
  
  const colorIndicator = document.createElement('div');
  colorIndicator.className = 'color-indicator';
  colorIndicator.style.backgroundColor = solidColor;
  card.appendChild(colorIndicator);
  
  const content = document.createElement('div');
  content.className = 'flight-card-content';
  
  // Flight callsign with proper airline formatting
  const callsign = document.createElement('div');
  callsign.className = 'flight-number';
  callsign.textContent = flight.callsign;
  content.appendChild(callsign);
  
  // Flight route with ICAO codes
  const route = document.createElement('div');
  route.className = 'flight-route';
  route.textContent = `${flight.origin} → ${flight.destination}`;
  content.appendChild(route);
  
  // Simple layout using the original style with fixed width values
  const detailsContainer = document.createElement('div');
  detailsContainer.style.marginTop = '6px';
  
  // Altitude detail
  const altDetail = document.createElement('div');
  altDetail.className = 'flight-detail';
  
  const altLabel = document.createElement('span');
  altLabel.textContent = 'ALT:';
  altLabel.style.marginRight = '4px';
  
  const altValue = document.createElement('span');
  altValue.className = 'alt-value';
  altValue.textContent = `${altitude.toLocaleString()} ft`;
  
  altDetail.appendChild(altLabel);
  altDetail.appendChild(altValue);
  detailsContainer.appendChild(altDetail);
  
  // Speed detail
  const spdDetail = document.createElement('div');
  spdDetail.className = 'flight-detail';
  
  const spdLabel = document.createElement('span');
  spdLabel.textContent = 'SPD:';
  spdLabel.style.marginRight = '4px';
  
  const spdValue = document.createElement('span');
  spdValue.className = 'spd-value';
  spdValue.textContent = `${groundSpeed} kts`;
  
  spdDetail.appendChild(spdLabel);
  spdDetail.appendChild(spdValue);
  detailsContainer.appendChild(spdDetail);
  
  // Heading detail
  const hdgDetail = document.createElement('div');
  hdgDetail.className = 'flight-detail';
  
  const hdgLabel = document.createElement('span');
  hdgLabel.textContent = 'HDG:';
  hdgLabel.style.marginRight = '4px';
  
  const hdgValue = document.createElement('span');
  hdgValue.className = 'hdg-value';
  // Format heading with leading zeros
  const formattedHeading = heading.toString().padStart(3, '0');
  hdgValue.textContent = `${formattedHeading}°`;
  
  hdgDetail.appendChild(hdgLabel);
  hdgDetail.appendChild(hdgValue);
  detailsContainer.appendChild(hdgDetail);
  
  // Vertical speed detail (optional)
  if (verticalSpeed !== 0) {
    const vsDetail = document.createElement('div');
    vsDetail.className = 'flight-detail';
    
    const vsLabel = document.createElement('span');
    vsLabel.textContent = 'V/S:';
    vsLabel.style.marginRight = '4px';
    
    const vsValue = document.createElement('span');
    vsValue.className = 'vs-value';
    // Format vertical speed with sign and fpm
    const vsSign = verticalSpeed > 0 ? '+' : '';
    vsValue.textContent = `${vsSign}${verticalSpeed} fpm`;
    
    vsDetail.appendChild(vsLabel);
    vsDetail.appendChild(vsValue);
    detailsContainer.appendChild(vsDetail);
  }
  
  content.appendChild(detailsContainer);
  
  // Add turbulence indicator if not smooth
  if (turbulence !== 'Smooth') {
    const turbDetail = document.createElement('div');
    turbDetail.className = 'turbulence-indicator';
    turbDetail.style.marginTop = '4px';
    turbDetail.style.fontSize = '11px';
    turbDetail.style.color = turbulence === 'Moderate' ? '#ffcc00' : '#a9a9a9';
    turbDetail.textContent = `${turbulence} Turbulence`;
    content.appendChild(turbDetail);
  }
  
  card.appendChild(content);
  
  // Add click event to highlight the plane on the map
  card.addEventListener('click', function() {
    // First, remove highlight from all planes
    clearAllHighlights();
    
    // Then, highlight this plane
    highlightPlane(flight.id);
    
    // Add selected class to this card
    this.classList.add('selected');
  });
  
  return card;
}

// Function to clear all highlights from planes
function clearAllHighlights() {
  // Remove selected class from all flight cards
  document.querySelectorAll('.flight-card.selected').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Remove highlight class from all planes
  document.querySelectorAll('.plane.highlighted').forEach(plane => {
    plane.classList.remove('highlighted');
  });
}

// Function to highlight a specific plane
function highlightPlane(flightId) {
  const plane = document.getElementById(flightId);
  if (plane) {
    // Add highlight class
    plane.classList.add('highlighted');
    
    // Ensure the plane is visible in the viewport
    plane.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    
    // Create a pulsing highlight effect
    createPulsingHighlight(plane);
  }
}

// Function to create a pulsing highlight effect
function createPulsingHighlight(plane) {
  // Remove any existing highlight animation
  const existingHighlight = document.getElementById('pulsing-highlight');
  if (existingHighlight) {
    existingHighlight.remove();
  }
  
  // Create a pulsing circle around the plane
  const highlight = document.createElement('div');
  highlight.id = 'pulsing-highlight';
  highlight.style.position = 'absolute';
  highlight.style.width = '30px';
  highlight.style.height = '30px';
  highlight.style.borderRadius = '50%';
  highlight.style.border = '2px solid #fff';
  highlight.style.transform = 'translate(-50%, -50%)';
  highlight.style.left = plane.style.left;
  highlight.style.top = plane.style.top;
  highlight.style.animation = 'pulse 1.5s infinite';
  highlight.style.pointerEvents = 'none'; // Don't interfere with mouse events
  highlight.style.zIndex = '1000';
  
  // Add the highlight to the map
  document.getElementById('flight-map').appendChild(highlight);
  
  // Create the CSS animation if it doesn't exist
  if (!document.getElementById('pulse-animation')) {
    const style = document.createElement('style');
    style.id = 'pulse-animation';
    style.textContent = `
      @keyframes pulse {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
          box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
        }
        70% {
          transform: translate(-50%, -50%) scale(2);
          opacity: 0;
          box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
        }
        100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// Update an existing flight card with new data
function updateFlightCardIfDisplayed(flight, flightInfo) {
  const card = document.getElementById(`card-${flight.id}`);
  if (card) {
    const altElement = card.querySelector('.alt-value');
    const spdElement = card.querySelector('.spd-value');
    const hdgElement = card.querySelector('.hdg-value');
    const vsElement = card.querySelector('.vs-value');
    
    if (altElement) altElement.textContent = `${flightInfo.altitude.toLocaleString()} ft`;
    if (spdElement) spdElement.textContent = `${flightInfo.groundSpeed} kts`;
    
    if (hdgElement) {
      // Format heading with leading zeros
      const formattedHeading = flightInfo.heading.toString().padStart(3, '0');
      hdgElement.textContent = `${formattedHeading}°`;
    }
    
    if (vsElement) {
      // Format vertical speed with sign
      const vsSign = flightInfo.verticalSpeed > 0 ? '+' : '';
      vsElement.textContent = `${vsSign}${flightInfo.verticalSpeed} fpm`;
    }
    
    // Update turbulence indicator if exists
    const turbElement = card.querySelector('.turbulence-indicator');
    if (turbElement) {
      if (flightInfo.turbulence === 'Smooth') {
        turbElement.style.display = 'none';
      } else {
        turbElement.style.display = 'block';
        turbElement.textContent = `${flightInfo.turbulence} Turbulence`;
        turbElement.style.color = flightInfo.turbulence === 'Moderate' ? '#ffcc00' : '#a9a9a9';
      }
    }
    
    // Update highlight position if this card is selected
    if (card.classList.contains('selected')) {
      const plane = document.getElementById(flight.id);
      const highlight = document.getElementById('pulsing-highlight');
      if (plane && highlight) {
        highlight.style.left = plane.style.left;
        highlight.style.top = plane.style.top;
      }
    }
  }
}

// Initialize permanent flights in the sidebar
function initializeRecentFlights() {
  // Clear any existing flight cards
  const container = document.querySelector('.flights-container');
  container.innerHTML = '';
  
  // Clear stored recent flights
  recentFlights = [];
  
  // Use the actual flight data instead of fixed data
  // Sort by progress to show flights in a consistent order
  const sortedFlights = [...flightData].sort((a, b) => a.progress - b.progress);
  
  // Calculate the total number of pages
  const totalPages = Math.ceil(sortedFlights.length / flightsPerPage);
  
  // Get the flights for the current page
  const startIndex = currentPage * flightsPerPage;
  const displayFlights = sortedFlights.slice(startIndex, startIndex + flightsPerPage);
  
  // Display the selected flights in the sidebar
  displayFlights.forEach(flight => {
    // Calculate flight info based on current progress
    const flightInfo = calculateFlightInfo(flight, flight.progress);
    
    // Create and add the card
    const card = createFlightCard(flight, flightInfo);
    container.appendChild(card);
    
    // Store this flight for later reference
    recentFlights.push({
      flight,
      flightInfo,
      timestamp: Date.now()
    });
  });
  
  // Add pagination controls
  addPaginationControls(container, totalPages);
}

// Add pagination controls
function addPaginationControls(container, totalPages) {
  // Remove any existing pagination controls first
  const existingControls = document.querySelector('.pagination-controls');
  if (existingControls) {
    existingControls.remove();
  }
  
  // Create pagination container
  const paginationDiv = document.createElement('div');
  paginationDiv.className = 'pagination-controls';
  
  // Add previous button
  const prevButton = document.createElement('button');
  prevButton.className = 'pagination-button';
  prevButton.innerHTML = '&larr;';
  prevButton.disabled = currentPage === 0;
  prevButton.addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      refreshFlightList();
    }
  });
  
  // Add page indicator
  const pageIndicator = document.createElement('span');
  pageIndicator.className = 'page-indicator';
  pageIndicator.textContent = `${currentPage + 1}/${totalPages}`;
  
  // Add next button
  const nextButton = document.createElement('button');
  nextButton.className = 'pagination-button';
  nextButton.innerHTML = '&rarr;';
  nextButton.disabled = currentPage >= totalPages - 1;
  nextButton.addEventListener('click', () => {
    if (currentPage < totalPages - 1) {
      currentPage++;
      refreshFlightList();
    }
  });
  
  // Add elements to pagination container
  paginationDiv.appendChild(prevButton);
  paginationDiv.appendChild(pageIndicator);
  paginationDiv.appendChild(nextButton);
  
  // Find the sidebar content div
  const sidebarContent = document.querySelector('.sidebar-content');
  sidebarContent.appendChild(paginationDiv);
}

// Refresh flight list to show current page
function refreshFlightList() {
  // Re-initialize with current page
  initializeRecentFlights();
}

// Animation loop with more realistic flight behavior
function animateFlights() {
  // Get current timestamp for calculations
  const now = Date.now();
  
  // Update each flight
  flightData.forEach(flight => {
    // Calculate real flight progress based on elapsed time since flight start
    // This makes flights move at different speeds based on their planned duration
    const elapsedTime = now - flight.actualStartTime;
    const normalizedProgress = Math.min(1, Math.max(0, elapsedTime / flight.plannedDuration));
    
    // Apply wind effects to progress (head/tailwinds)
    let adjustedProgress = normalizedProgress * (1 + flight.windFactor);
    
    // Make sure progress is between 0-1
    adjustedProgress = Math.min(1, Math.max(0, adjustedProgress));
    
    // Get current path segment
    const totalPathPoints = flight.path.length - 1;
    const exactIndex = adjustedProgress * totalPathPoints;
    const currentIndex = Math.floor(exactIndex);
    const nextIndex = Math.min(currentIndex + 1, totalPathPoints);
    const segmentProgress = exactIndex - currentIndex;
    
    // Current position data
    const currentPoint = flight.path[currentIndex];
    const nextPoint = flight.path[nextIndex];
    
    // Get the plane and path elements
    const plane = planeDivs[flight.id];
    const pathCanvas = pathCanvases[flight.id];
    
    if (!plane || !pathCanvas) return;
    
    // Calculate realistic flight info based on progress, position and heading
    const flightInfo = calculateFlightInfo(flight, adjustedProgress, currentPoint, nextPoint, segmentProgress);
    
    // Update plane position with current weather effects 
    updatePlanePosition(plane, flight, adjustedProgress, flightInfo);
    
    // Update flight path with current progress
    drawFlightPath(pathCanvas, flight, adjustedProgress);
    
    // Update the flight card if it exists
    updateFlightCardIfDisplayed(flight, flightInfo);
    
    // If flight has completed and recycling is needed
    if (adjustedProgress >= 1) {
      // Reset flight to start with new random factors
      flight.progress = 0;
      flight.actualStartTime = now + Math.random() * 30000; // Start again after 0-30 seconds
      flight.plannedDuration = 300000 + Math.random() * 300000; // 5-10 minutes
      flight.windFactor = (Math.random() * 0.4) - 0.2; // New wind conditions
      flight.turbulence = Math.random() * 0.2; // New turbulence level
    }
  });
  
  // Continue animation loop
  requestAnimationFrame(animateFlights);
}

// Calculate more realistic flight information based on progress and position
function calculateFlightInfo(flight, progress, currentPoint, nextPoint, segmentProgress) {
  const totalPathPoints = flight.path.length - 1;
  const currentIndex = Math.floor(progress * totalPathPoints);
  
  // Calculate actual heading based on current path segment
  let heading = 0;
  if (currentPoint && nextPoint) {
    heading = Math.round(calculateHeading(currentPoint.lat, currentPoint.lon, nextPoint.lat, nextPoint.lon));
    
    // Add micro-variations based on turbulence
    const turbulenceEffect = Math.sin(Date.now() / 2000 + flight.seed * 10) * flight.turbulence * 2;
    heading += turbulenceEffect;
    
    // Normalize heading to 0-359
    heading = Math.round((heading + 360) % 360);
  }

  // Calculate altitude based on flight phase
  let altitude, groundSpeed;
  
  // Base cruise altitude and speed that vary by aircraft type/route
  // If not previously set, create them now
  if (!flight.cruiseAlt) {
    // Determine based on route length and aircraft type
    const directDistance = Math.sqrt(
      Math.pow(flight.path[0].lat - flight.path[flight.path.length-1].lat, 2) + 
      Math.pow(flight.path[0].lon - flight.path[flight.path.length-1].lon, 2)
    );
    
    if (directDistance < 3) {
      // Regional jets / smaller aircraft
      flight.cruiseAlt = 25000 + Math.floor(Math.random() * 5000); // 25k-30k feet
      flight.cruiseSpeed = 350 + Math.floor(Math.random() * 70); // 350-420 knots
    } else if (directDistance < 7) {
      // Medium range - 737/A320 types
      flight.cruiseAlt = 32000 + Math.floor(Math.random() * 4000); // 32k-36k feet
      flight.cruiseSpeed = 420 + Math.floor(Math.random() * 60); // 420-480 knots
    } else {
      // Long range - wide body jets
      flight.cruiseAlt = 35000 + Math.floor(Math.random() * 5000); // 35k-40k feet
      flight.cruiseSpeed = 450 + Math.floor(Math.random() * 50); // 450-500 knots
    }
  }
  
  const cruiseAltitude = flight.cruiseAlt;
  
  // Calculate flight phase
  if (progress < 0.15) {
    // CLIMB PHASE
    const climbProgress = progress / 0.15;
    const easeInOut = climbProgress < 0.5 
      ? 2 * climbProgress * climbProgress 
      : 1 - Math.pow(-2 * climbProgress + 2, 2) / 2;
    
    altitude = 1500 + easeInOut * (cruiseAltitude - 1500);
    
    // Speed increases during climb
    if (altitude < 10000) {
      // Below 10,000 ft - limited to 250 knots
      groundSpeed = 170 + easeInOut * 80; // 170-250 knots
    } else {
      // Above 10,000 ft - can accelerate more
      const climbAbove10kProgress = (altitude - 10000) / (cruiseAltitude - 10000);
      groundSpeed = 250 + climbAbove10kProgress * (flight.cruiseSpeed - 250); // 250-cruise knots
    }
  } 
  else if (progress > 0.85) {
    // DESCENT PHASE
    const descentProgress = (progress - 0.85) / 0.15;
    const easeInOut = descentProgress < 0.5 
      ? 2 * descentProgress * descentProgress 
      : 1 - Math.pow(-2 * descentProgress + 2, 2) / 2;
    
    altitude = cruiseAltitude - easeInOut * (cruiseAltitude - 1500);
    
    // Speed decreases during descent
    if (altitude < 10000) {
      // Below 10,000 ft - must be at 250 knots or lower
      const descentBelow10kProgress = (10000 - altitude) / 8500;
      groundSpeed = 250 - descentBelow10kProgress * 80; // 250-170 knots
    } else {
      // Above 10,000 ft - gradually decreasing
      const descentAbove10kProgress = (cruiseAltitude - altitude) / (cruiseAltitude - 10000);
      groundSpeed = flight.cruiseSpeed - descentAbove10kProgress * (flight.cruiseSpeed - 250); // cruise-250 knots
    }
  } 
  else {
    // CRUISE PHASE - Small variations in altitude and speed
    // Use sine waves with flight's unique seed for consistent behavior
    const cruisePhaseProgress = (progress - 0.15) / 0.7; // Normalized progress through cruise phase
    const sineWave = Math.sin(cruisePhaseProgress * Math.PI * 3 + flight.seed * 10) * 0.5;
    
    // Create natural altitude variations (aircraft never maintain perfectly level flight)
    altitude = cruiseAltitude + sineWave * 100;
    
    // Create natural speed variations (due to wind, small course adjustments, etc)
    groundSpeed = flight.cruiseSpeed + sineWave * 10; 
    
    // Apply wind factor to cruise speed
    groundSpeed = groundSpeed * (1 + flight.windFactor * 0.3);
  }
  
  // Ensure min/max values are respected
  altitude = Math.max(1000, Math.min(altitude, 41000));
  groundSpeed = Math.max(150, Math.min(groundSpeed, 550));
  
  // Add random micro-variation to flight parameters based on turbulence
  if (flight.turbulence > 0.05) {
    const turbulenceAltEffect = (Math.random() * 2 - 1) * flight.turbulence * 50;
    altitude += turbulenceAltEffect;
    
    const turbulenceSpeedEffect = (Math.random() * 2 - 1) * flight.turbulence * 5;
    groundSpeed += turbulenceSpeedEffect;
  }

  return { 
    altitude: Math.round(altitude),
    groundSpeed: Math.round(groundSpeed),
    heading,
    verticalSpeed: calculateVerticalSpeed(progress, altitude, flight),
    turbulence: flight.turbulence > 0.15 ? "Moderate" : flight.turbulence > 0.05 ? "Light" : "Smooth"
  };
}

// Calculate vertical speed in feet per minute based on phase of flight
function calculateVerticalSpeed(progress, altitude, flight) {
  if (progress < 0.15) {
    // Climb phase
    const climbProgress = progress / 0.15;
    if (climbProgress < 0.2) {
      // Initial climb: 1000-2000 fpm
      return Math.round(1000 + 1000 * (climbProgress / 0.2));
    } else if (climbProgress < 0.8) {
      // Mid climb: 1800-2200 fpm
      return Math.round(2000 + 200 * Math.sin(climbProgress * Math.PI));
    } else {
      // Level off: 2000-0 fpm
      return Math.round(2000 * (1 - ((climbProgress - 0.8) / 0.2)));
    }
  } 
  else if (progress > 0.85) {
    // Descent phase
    const descentProgress = (progress - 0.85) / 0.15;
    if (descentProgress < 0.2) {
      // Initial descent: 0 to -800 fpm
      return Math.round(-800 * (descentProgress / 0.2));
    } else if (descentProgress < 0.8) {
      // Mid descent: -800 to -1500 fpm
      return Math.round(-800 - 700 * ((descentProgress - 0.2) / 0.6));
    } else {
      // Final approach: -1500 to -700 fpm
      return Math.round(-1500 + 800 * ((descentProgress - 0.8) / 0.2));
    }
  } 
  else {
    // Cruise phase - small variations around zero
    return Math.round((Math.random() * 100 - 50) * flight.turbulence);
  }
}

// Update the position of a plane with realistic variations
function updatePlanePosition(plane, flight, progress, flightInfo) {
  const exactIndex = progress * (flight.path.length - 1);
  const index = Math.floor(exactIndex);
  const nextIndex = Math.min(index + 1, flight.path.length - 1);
  const t = exactIndex - index;
  
  const currentPoint = flight.path[index];
  const nextPoint = flight.path[nextIndex];
  
  // Interpolate position
  const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * t;
  const lon = currentPoint.lon + (nextPoint.lon - currentPoint.lon) * t;
  
  // Apply turbulence effect for visual interest (real planes don't follow perfect paths)
  const turbFactor = flight.turbulence * Math.sin(Date.now() / 200 + flight.seed * 10) * 0.0005;
  const turbLat = lat + turbFactor;
  const turbLon = lon + turbFactor;
  
  // Get heading directly from flight info
  const angle = flightInfo.heading;
  
  const pixels = coordsToPixels(turbLat, turbLon);
  
  // Apply -90 degree offset for asterisk '*' visual alignment
  plane.style.left = pixels.x + 'px';
  plane.style.top = pixels.y + 'px';
  plane.style.transform = `translate(-50%, -50%) rotate(${angle - 90}deg)`;
  
  // Update tooltip if it's showing
  const tooltip = document.getElementById('tooltip');
  if (tooltip && tooltip.style.opacity === '1' && document.querySelector(':hover') === plane) {
    const planeRect = plane.getBoundingClientRect();
    tooltip.style.left = `${planeRect.left + planeRect.width/2}px`;
    tooltip.style.top = `${planeRect.top - tooltip.offsetHeight - 10}px`;
  }
  
  // Update highlight position if this plane is highlighted
  if (plane.classList.contains('highlighted')) {
    const highlight = document.getElementById('pulsing-highlight');
    if (highlight) {
      highlight.style.left = pixels.x + 'px';
      highlight.style.top = pixels.y + 'px';
    }
  }
}

// Show tooltip with detailed flight information
function showTooltip(event) {
  const plane = event.target;
  
  // Get current flight data
  const flightId = plane.id;
  const flight = flightData.find(f => f.id === flightId);
  
  if (!flight) return;
  
  // Calculate current progress and flight information
  const now = Date.now();
  const elapsedTime = now - flight.actualStartTime;
  const progress = Math.min(1, Math.max(0, elapsedTime / flight.plannedDuration));
  
  // Get current path position
  const totalPathPoints = flight.path.length - 1;
  const exactIndex = progress * totalPathPoints;
  const currentIndex = Math.floor(exactIndex);
  const nextIndex = Math.min(currentIndex + 1, totalPathPoints);
  const currentPoint = flight.path[currentIndex];
  const nextPoint = flight.path[nextIndex];
  const segmentProgress = exactIndex - currentIndex;
  
  // Get detailed flight info
  const flightInfo = calculateFlightInfo(flight, progress, currentPoint, nextPoint, segmentProgress);
  
  // Create or get tooltip element
  let tooltip = document.getElementById('tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'tooltip';
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
  }
  
  // Format values correctly
  const formattedHeading = flightInfo.heading.toString().padStart(3, '0');
  const vsSign = flightInfo.verticalSpeed >= 0 ? '+' : '';
  
  // Calculate phase text
  let phaseText = "En Route";
  if (progress < 0.15) phaseText = "Climbing";
  else if (progress > 0.85) phaseText = "Descending";
  
  // Simple classic layout - more compact and clearer
  tooltip.innerHTML = `
    <div style="border-left: 4px solid ${flight.color}; padding-left: 8px;">
      <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${flight.callsign}</div>
      <div style="font-size: 12px;">${flight.origin} → ${flight.destination} (${phaseText})</div>
      <div style="font-size: 12px; margin-top: 6px;">
        ALT: ${flightInfo.altitude.toLocaleString()} ft · 
        SPD: ${flightInfo.groundSpeed} kts
      </div>
      <div style="font-size: 12px;">
        HDG: ${formattedHeading}° · 
        V/S: ${vsSign}${flightInfo.verticalSpeed} fpm
      </div>
      ${flightInfo.turbulence !== 'Smooth' ? 
        `<div style="font-size: 11px; margin-top: 4px; color: ${flightInfo.turbulence === 'Moderate' ? '#ffcc00' : '#a9a9a9'};">${flightInfo.turbulence} Turbulence</div>` 
        : ''}
    </div>
  `;
  
  // Position tooltip above the plane
  const planeRect = plane.getBoundingClientRect();
  tooltip.style.left = `${planeRect.left + planeRect.width/2}px`;
  tooltip.style.top = `${planeRect.top - tooltip.offsetHeight - 10}px`;
  tooltip.style.transform = 'translateX(-50%)';
  tooltip.style.opacity = '1';
}

// Hide tooltip
function hideTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
  }
}

// Handle window resize and sidebar toggle
function handleResize() {
  initializeMapDimensions(); // Recalculate dimensions
  
  // Resize and redraw all path canvases
  Object.values(pathCanvases).forEach(canvas => {
    if (canvas) {
      canvas.width = MAP_WIDTH;
      canvas.height = MAP_HEIGHT;
      // Find the flight for this canvas and redraw its path
      const flight = flightData.find(f => `path-${f.id}` === canvas.id);
      if (flight) {
        drawFlightPath(canvas, flight, flight.progress);
      }
    }
  });

  // Update plane positions
  flightData.forEach(flight => {
    const plane = planeDivs[flight.id];
    if (plane) {
      updatePlanePosition(plane, flight, flight.progress);
    }
  });
  console.log("Map and flights redrawn after resize/toggle.");
}

// Set up sidebar toggle functionality
function setupSidebarToggle() {
  const toggleButton = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  // mainContent is not strictly needed here if we rely on flex layout

  if (toggleButton && sidebar) {
    toggleButton.addEventListener('click', function() {
      sidebarVisible = !sidebarVisible;
      
      if (sidebarVisible) {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = '280px';
        this.style.transform = 'rotate(180deg)';
      } else {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '32px';
        this.style.transform = 'rotate(0deg)';
      }
      // Dispatch a resize event to trigger map redraw
      // Use a timeout to allow CSS transitions to start
      setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    });
  }
}

// Initialize the map and flights
function initializeMap() {
  console.log("Starting map initialization");
  
  initializeMapDimensions();
  addMapFeatures();
  
  flightData = generateFlights();
  
  flightData.forEach(flight => {
    planeDivs[flight.id] = createPlane(flight);
    pathCanvases[flight.id] = createPathCanvas(flight);
  });
  
  initializeRecentFlights();
  setupSidebarToggle(); // Setup toggle after elements are in DOM
  
  // Add click handler to the map to clear highlights when clicking on an empty area
  const map = document.getElementById('flight-map');
  map.addEventListener('click', function(event) {
    // Only clear if the click was directly on the map (not on a plane)
    if (event.target === map) {
      clearAllHighlights();
      
      // Remove the pulsing highlight effect
      const highlight = document.getElementById('pulsing-highlight');
      if (highlight) {
        highlight.remove();
      }
    }
  });
  
  if (!animationRunning) {
    animationRunning = true;
    animateFlights();
  }
  
  window.addEventListener('resize', handleResize);
  console.log("Map initialization complete");
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initializeMap); 