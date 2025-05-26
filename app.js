class LocationTracker {
    constructor() {
        this.trackPoints = [];
        this.isTracking = false;
        this.watchId = null;
        this.lastUpdate = 0;
        this.updateInterval = 1000; // Update every 1 second
        this.db = null;

        // DOM elements
        this.startBtn = document.getElementById('startBtn');
        this.endBtn = document.getElementById('endBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.deleteBtn = document.getElementById('deleteBtn');
        this.trackNameInput = document.getElementById('trackNameInput');
        this.status = document.getElementById('status');
        this.coordinates = document.getElementById('coordinates');
        this.tracksList = document.getElementById('tracksList');
        this.saveControls = document.getElementById('saveControls');

        // Bind event listeners
        this.startBtn.addEventListener('click', () => this.startTracking());
        this.endBtn.addEventListener('click', () => this.stopTracking());
        this.saveBtn.addEventListener('click', () => this.saveTrack());
        this.deleteBtn.addEventListener('click', () => this.deleteCurrentTrack());
        this.trackNameInput.addEventListener('input', () => this.updateSaveButton());

        // Check if geolocation is supported
        if (!navigator.geolocation) {
            this.status.textContent = 'Geolocation is not supported by your browser';
            this.startBtn.disabled = true;
        }

        // Initialize database
        this.initDB().then(() => {
            this.renderSavedTracks();
        }).catch(error => {
            console.error('Error initializing database:', error);
            this.status.textContent = 'Error initializing storage';
        });
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('LocationTracker', 1);

            request.onerror = () => {
                console.error('Error opening database');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('tracks')) {
                    db.createObjectStore('tracks', { keyPath: 'id' });
                }
            };
        });
    }

    async saveTrack() {
        const trackName = this.trackNameInput.value.trim();
        if (!trackName || this.trackPoints.length === 0) return;

        const track = {
            id: Date.now(),
            name: trackName,
            points: [...this.trackPoints],
            date: new Date().toISOString()
        };

        try {
            const transaction = this.db.transaction(['tracks'], 'readwrite');
            const store = transaction.objectStore('tracks');
            await store.add(track);
            
            this.renderSavedTracks();
            this.trackPoints = [];
            this.trackNameInput.value = '';
            
            // Show/hide buttons
            this.startBtn.style.display = 'inline-block';
            this.endBtn.style.display = 'none';
            this.deleteBtn.style.display = 'none';
            this.saveControls.style.display = 'none';
        } catch (error) {
            console.error('Error saving track:', error);
            this.status.textContent = 'Error saving track';
        }
    }

    async getAllTracks() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readonly');
            const store = transaction.objectStore('tracks');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async deleteTrack(trackId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readwrite');
            const store = transaction.objectStore('tracks');
            const request = store.delete(trackId);

            request.onsuccess = () => {
                this.renderSavedTracks();
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async renderSavedTracks() {
        try {
            const tracks = await this.getAllTracks();
            this.tracksList.innerHTML = tracks.map(track => `
                <div class="track-item">
                    <div>
                        <strong>${track.name}</strong>
                        <div>${new Date(track.date).toLocaleString()}</div>
                        <div>${track.points.length} points</div>
                    </div>
                    <div class="track-actions">
                        <button class="download-btn" onclick="tracker.downloadTrack(${track.id})">Download</button>
                        <button class="delete-btn" onclick="tracker.deleteTrack(${track.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error rendering tracks:', error);
            this.status.textContent = 'Error loading tracks';
        }
    }

    showControls(state) {
        // Hide all control sections
        this.trackingControls.style.display = 'none';
        this.activeTrackingControls.style.display = 'none';
        this.saveControls.style.display = 'none';

        // Show relevant controls based on state
        switch(state) {
            case 'tracking':
                this.trackingControls.style.display = 'block';
                break;
            case 'active':
                this.activeTrackingControls.style.display = 'block';
                break;
            case 'save':
                this.saveControls.style.display = 'block';
                break;
        }
    }

    startTracking() {
        console.log('Starting tracking...');
        this.trackPoints = [];
        this.isTracking = true;
        this.trackNameInput.value = '';
        this.status.textContent = 'Status: Tracking...';
        this.status.className = 'tracking';
        
        // Show/hide buttons
        this.startBtn.style.display = 'none';
        this.endBtn.style.display = 'inline-block';
        this.deleteBtn.style.display = 'none';
        this.saveControls.style.display = 'none';

        // Get initial position immediately
        navigator.geolocation.getCurrentPosition(
            (position) => this.handlePosition(position),
            (error) => this.handleError(error),
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );

        // Then start watching position
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePosition(position),
            (error) => this.handleError(error),
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );
    }

    stopTracking() {
        console.log('Stopping tracking...');
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
        this.status.textContent = 'Status: Tracking stopped';
        this.status.className = 'stopped';
        
        // Show/hide buttons
        this.startBtn.style.display = 'inline-block';
        this.endBtn.style.display = 'none';
        
        if (this.trackPoints.length > 0) {
            this.saveControls.style.display = 'block';
            this.deleteBtn.style.display = 'inline-block';
        } else {
            this.deleteBtn.style.display = 'none';
            this.saveControls.style.display = 'none';
        }
    }

    handlePosition(position) {
        const now = Date.now();
        if (now - this.lastUpdate >= this.updateInterval) {
            const point = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                ele: position.coords.altitude || 0,
                time: new Date(position.timestamp).toISOString()
            };
            
            // Only add point if it's different from the last one
            if (this.trackPoints.length === 0 || 
                this.trackPoints[this.trackPoints.length - 1].lat !== point.lat || 
                this.trackPoints[this.trackPoints.length - 1].lon !== point.lon) {
                this.trackPoints.push(point);
                this.lastUpdate = now;
                this.updateCoordinatesDisplay(point);
            }
        }
    }

    handleError(error) {
        this.status.textContent = `Error: ${error.message}`;
        this.status.className = 'stopped';
        this.stopTracking();
    }

    updateCoordinatesDisplay(point) {
        this.coordinates.textContent = `Latest coordinates: ${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`;
    }

    updateSaveButton() {
        this.saveBtn.disabled = !this.trackNameInput.value.trim() || this.trackPoints.length === 0;
    }

    async downloadTrack(trackId) {
        try {
            const transaction = this.db.transaction(['tracks'], 'readonly');
            const store = transaction.objectStore('tracks');
            const request = store.get(trackId);

            request.onsuccess = () => {
                const track = request.result;
                if (!track) {
                    console.error('Track not found');
                    return;
                }

                const gpx = this.generateGPX(track);
                const blob = new Blob([gpx], { type: 'application/gpx+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${track.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gpx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };

            request.onerror = () => {
                console.error('Error downloading track:', request.error);
            };
        } catch (error) {
            console.error('Error in downloadTrack:', error);
        }
    }

    generateGPX(track) {
        const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Location Tracker"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <trk>
    <name>${track.name}</name>
    <trkseg>`;

        const points = track.points.map(point => `
      <trkpt lat="${point.lat}" lon="${point.lon}">
        <ele>${point.ele}</ele>
        <time>${point.time}</time>
      </trkpt>`).join('');

        const footer = `
    </trkseg>
  </trk>
</gpx>`;

        return header + points + footer;
    }

    deleteCurrentTrack() {
        this.trackPoints = [];
        this.trackNameInput.value = '';
        this.coordinates.textContent = 'Latest coordinates: None';
        this.status.textContent = 'Status: Track deleted';
        this.status.className = 'stopped';
        
        // Show/hide buttons
        this.startBtn.style.display = 'inline-block';
        this.endBtn.style.display = 'none';
        this.deleteBtn.style.display = 'none';
        this.saveControls.style.display = 'none';
    }
}

// Initialize the tracker when the page loads
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new LocationTracker();
}); 