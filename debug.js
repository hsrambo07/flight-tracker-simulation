// Debug script to check initialization
console.log("Debug script loaded");

// Check if DOM is loaded before running map initialization
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded and parsed");
  
  // Check map container
  const mapContainer = document.getElementById('map-container');
  console.log("Map container:", mapContainer);
  
  // Check flight map
  const flightMap = document.getElementById('flight-map');
  console.log("Flight map:", flightMap);
  
  // Log window dimensions
  console.log("Window dimensions:", window.innerWidth, window.innerHeight);
  console.log("Calculated map width:", window.innerWidth - 280);
}); 