document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    // Theme handling
    const themeSwitch = document.getElementById('theme-switch');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSwitch.checked = savedTheme === 'dark';

    // Theme switch event listener
    themeSwitch.addEventListener('change', function() {
        const theme = this.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });

    // Check if mobile device
    if (isMobile()) {
        console.log('Mobile device detected');
        updateMobileView();
    }

    // Show initial loading state
    showLoading();

    // Check location permission and fetch location
    checkLocationPermission();

    // Load leaderboard
    loadLeaderboard();
});

window.onload = function () {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                console.log("User location:", latitude, longitude);

                // Call your API to fetch AQI data here
                // updateAQIData(latitude, longitude);
            },
            function (error) {
                console.error("Error getting location:", error);
                document.getElementById("current-aqi").innerHTML = "<p>Unable to retrieve location.</p>";
            }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
};


// Mobile navigation handling
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.getAttribute('data-section');
        document.querySelectorAll('.mobile-section').forEach(s => s.classList.remove('active'));
        document.querySelector(`#${section}-mobile`).classList.add('active');
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

function isMobile() {
    return window.innerWidth <= 768;
}

function updateMobileView() {
    document.querySelector('.desktop-view').style.display = 'none';
    document.querySelector('.mobile-view').style.display = 'block';
}

function showLoading() {
    const container = isMobile() ? 
        document.getElementById('current-aqi-content') : 
        document.getElementById('current-aqi');
    
    if (container) {
        container.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading AQI data...</p>
            </div>
        `;
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message alert alert-danger';
    errorDiv.textContent = message;
    
    const container = isMobile() ? 
        document.querySelector('.mobile-view') : 
        document.querySelector('.desktop-view');
    
    if (container) {
        // Remove any existing error messages
        const existingError = container.querySelector('.error-message');
        if (existingError) existingError.remove();
        
        container.insertBefore(errorDiv, container.firstChild);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

async function fetchAQIData(lat, lon) {
    showLoading();
    try {
        console.log('Fetching AQI data for coordinates:', lat, lon);
        
        // Add timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('/get_aqi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lat, lon }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received AQI data:', data);
        
        if (!data || data.status !== 'success') {
            throw new Error('Invalid API response');
        }

        displayCurrentAQI(data);
        fetchHistoricalData(data.data.city, data.data.state, data.data.country);
    } catch (error) {
        console.error('Error fetching AQI data:', error);
        if (error.name === 'AbortError') {
            showError('Request timed out. Please check your internet connection and try again.');
        } else {
            showError(error.message || 'Unable to fetch AQI data. Please try again later.');
        }
    }
}

async function fetchDefaultCityData() {
    try {
        const response = await fetch('/get_aqi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lat: 28.6139, lon: 77.2090 }) // Delhi coordinates
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data || data.status !== 'success') {
            throw new Error('Invalid API response');
        }

        displayCurrentAQI(data);
        fetchHistoricalData(data.data.city, data.data.state, data.data.country);
    } catch (error) {
        console.error('Error fetching default city data:', error);
        showError('Unable to fetch AQI data. Please try again later.');
    }
}

function displayCurrentAQI(data) {
    const container = isMobile() ? 
        document.getElementById('current-aqi-content') : 
        document.getElementById('current-aqi');
    
    if (!container) {
        console.error('AQI display container not found');
        return;
    }

    if (!data || !data.data || !data.data.current) {
        showError('Invalid AQI data received');
        return;
    }

    const aqi = data.data.current.pollution.aqius;
    const pm25 = data.data.current.pollution.p2;
    const pm10 = data.data.current.pollution.p1;
    const temp = data.data.current.weather.tp;
    const humidity = data.data.current.weather.hu;

    const aqiStatus = getAQIStatus(aqi);
    const statusClass = aqiStatus.toLowerCase().replace(' ', '-');

    container.innerHTML = `
        <div class="aqi-display">
            <div class="location-info">
                <h3>${data.data.city}, ${data.data.state}</h3>
                <p>${data.data.country}</p>
            </div>
            <div class="aqi-value ${statusClass}">
                <h2>${aqi}</h2>
                <p>AQI</p>
            </div>
            <div class="aqi-details">
                <div class="detail-item">
                    <span>PM2.5</span>
                    <span>${pm25} µg/m³</span>
                </div>
                <div class="detail-item">
                    <span>PM10</span>
                    <span>${pm10} µg/m³</span>
                </div>
                <div class="detail-item">
                    <span>Temperature</span>
                    <span>${temp}°C</span>
                </div>
                <div class="detail-item">
                    <span>Humidity</span>
                    <span>${humidity}%</span>
                </div>
            </div>
            <div class="aqi-status ${statusClass}">
                ${aqiStatus}
            </div>
        </div>
    `;
}

async function fetchHistoricalData(city, state, country) {
    if (!city || !state || !country) {
        showError('Location data not available for historical data');
        return;
    }

    try {
        const response = await fetch('/get_historical', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ city, state, country })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayHistoricalGraph(data);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        showError('Unable to fetch historical data');
    }
}

function displayHistoricalGraph(data) {
    const container = isMobile() ? 
        document.getElementById('historical-graph-mobile') : 
        document.getElementById('historical-graph');
    
    if (!container) {
        console.error('Historical graph container not found');
        return;
    }

    if (!data || !Array.isArray(data)) {
        showError('Invalid historical data received');
        return;
    }

    // Process and display historical data
    const timestamps = data.map(item => new Date(item.ts).toLocaleTimeString());
    const aqiValues = data.map(item => item.pollution.aqius);

    const trace = {
        x: timestamps,
        y: aqiValues,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'AQI',
        line: {
            color: 'var(--primary-color)',
            width: 2
        },
        marker: {
            size: 8,
            color: 'var(--primary-color)'
        }
    };

    const layout = {
        title: '24-Hour AQI History',
        xaxis: {
            title: 'Time',
            gridcolor: 'var(--border-color)',
            color: 'var(--text-color)'
        },
        yaxis: {
            title: 'AQI',
            gridcolor: 'var(--border-color)',
            color: 'var(--text-color)'
        },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: {
            color: 'var(--text-color)'
        }
    };

    Plotly.newPlot(container, [trace], layout);
}

async function loadLeaderboard() {
    try {
        const response = await fetch('/leaderboard');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('Invalid leaderboard data received');
        }

        displayLeaderboard(data);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showLeaderboardError();
    }
}

setTimeout(() => {
    const aqiElement = document.getElementById("current-aqi");
    if (aqiElement.innerHTML.includes("spinner")) {
        aqiElement.innerHTML = "<p>Failed to load AQI data. Please try again later.</p>";
    }
}, 5000);


function displayLeaderboard(data) {
    const container = isMobile() ? 
        document.getElementById('mobile-leaderboard-body') : 
        document.getElementById('leaderboard-body');
    
    if (!container) {
        console.error('Leaderboard container not found');
        return;
    }

    container.innerHTML = data.map((city, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <div class="city-info">
                    <span class="city-name">${city.city}</span>
                    <span class="city-location">${city.state}, ${city.country}</span>
                </div>
            </td>
            <td>${city.aqi}</td>
            <td>
                <span class="aqi-status ${getAQIStatus(city.aqi).toLowerCase().replace(' ', '-')}">
                    ${getAQIStatus(city.aqi)}
                </span>
            </td>
        </tr>
    `).join('');
}

function showLeaderboardError() {
    const container = isMobile() ? 
        document.getElementById('mobile-leaderboard-body') : 
        document.getElementById('leaderboard-body');
    
    if (container) {
        container.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    <div class="alert alert-warning" role="alert">
                        Unable to load leaderboard data. Please try again later.
                    </div>
                </td>
            </tr>
        `;
    }
}

function getAQIStatus(aqi) {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
}

// Add new function for location fetching with retry
function fetchUserLocation(retryCount = 0) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                console.log('Got location:', latitude, longitude);
                fetchAQIData(latitude, longitude);
            },
            error => {
                console.error('Error getting location:', error);
                if (retryCount < 2) {
                    setTimeout(() => fetchUserLocation(retryCount + 1), 2000);
                } else {
                    showError('Please enable location access in your device settings to get accurate AQI data.');
                    const retryButton = document.createElement('button');
                    retryButton.className = 'btn btn-primary mt-2';
                    retryButton.textContent = 'Retry Location Access';
                    retryButton.onclick = () => fetchUserLocation(0);
                    document.querySelector('.error-message').appendChild(retryButton);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        console.error('Geolocation is not supported by this browser');
        showError('Geolocation is not supported by your browser. Please use a modern browser with location services enabled.');
    }
}

// Add this function to handle location permission status
function checkLocationPermission() {
    console.log('Checking location permission...');
    if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' })
            .then(permissionStatus => {
                console.log('Permission status:', permissionStatus.state);
                if (permissionStatus.state === 'denied') {
                    showError('Location access is denied. Please enable it in your device settings.');
                } else if (permissionStatus.state === 'prompt') {
                    console.log('Requesting location permission...');
                    fetchUserLocation();
                } else if (permissionStatus.state === 'granted') {
                    console.log('Location permission already granted');
                    fetchUserLocation();
                }
                
                permissionStatus.onchange = () => {
                    console.log('Permission status changed to:', permissionStatus.state);
                    if (permissionStatus.state === 'granted') {
                        fetchUserLocation();
                    }
                };
            })
            .catch(error => {
                console.error('Error checking location permission:', error);
                fetchUserLocation();
            });
    } else {
        console.log('Permissions API not supported, using regular geolocation');
        fetchUserLocation();
    }
} 
