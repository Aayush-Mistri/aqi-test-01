from flask import Flask, render_template, jsonify, request
import requests
import os
from datetime import datetime, timedelta
import pandas as pd
import plotly.express as px
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

IQAIR_API_KEY = 'ac27ccc7-6f2a-46c0-b3ba-feeafeda4cd8'
BASE_URL = "https://api.airvisual.com/v2"

def get_aqi_data(lat, lon):
    """Fetch real-time AQI data for given coordinates"""
    try:
        print(f"Making API request to IQAir for coordinates: {lat}, {lon}")
        # First try to get data for exact coordinates
        url = f"{BASE_URL}/nearest_city?lat={lat}&lon={lon}&key={IQAIR_API_KEY}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        print(f"API Response status: {response.status_code}")
        print(f"API Response data: {data}")
        
        if response.status_code == 200 and data.get('status') == 'success':
            return data
        
        # If exact coordinates fail, try to get data for the nearest city
        if data.get('data', {}).get('city'):
            city = data['data']['city']
            state = data['data']['state']
            country = data['data']['country']
            
            print(f"Trying nearest city: {city}, {state}, {country}")
            url = f"{BASE_URL}/city?city={city}&state={state}&country={country}&key={IQAIR_API_KEY}"
            response = requests.get(url, timeout=10)
            data = response.json()
            
            if response.status_code == 200 and data.get('status') == 'success':
                return data
        
        print("Both coordinate and city attempts failed, returning default data")
        return get_default_city_data()
    except requests.exceptions.RequestException as e:
        print(f"Network error in get_aqi_data: {str(e)}")
        return get_default_city_data()
    except Exception as e:
        print(f"Error in get_aqi_data: {str(e)}")
        return get_default_city_data()

def get_default_city_data():
    """Get data for a default city when location data fails"""
    try:
        url = f"{BASE_URL}/city?city=Delhi&state=Delhi&country=India&key={IQAIR_API_KEY}"
        response = requests.get(url, timeout=10)
        data = response.json()
        if response.status_code == 200 and data.get('status') == 'success':
            return data
        raise Exception("Failed to fetch default city data")
    except Exception as e:
        print(f"Error in get_default_city_data: {str(e)}")
        return {
            "status": "success",
            "data": {
                "city": "Delhi",
                "state": "Delhi",
                "country": "India",
                "current": {
                    "pollution": {
                        "aqius": 150,
                        "p2": 50,
                        "p1": 100
                    },
                    "weather": {
                        "tp": 25,
                        "hu": 60
                    }
                }
            }
        }

def get_historical_data(city, state, country):
    """Fetch historical AQI data for the last 24 hours"""
    try:
        url = f"{BASE_URL}/city?city={city}&state={state}&country={country}&key={IQAIR_API_KEY}"
        response = requests.get(url)
        data = response.json()
        
        if response.status_code == 200 and data.get('status') == 'success':
            return data
        
        # If historical data is not available, create mock data
        return create_mock_historical_data(city, state, country, data)
    except Exception as e:
        print(f"Error in get_historical_data: {str(e)}")
        return create_mock_historical_data(city, state, country)

def create_mock_historical_data(city, state, country, current_data=None):
    """Create mock historical data when real data is not available"""
    current_time = datetime.now()
    history = []
    
    for i in range(24):
        timestamp = current_time - timedelta(hours=i)
        aqi = current_data['data']['current']['pollution']['aqius'] if current_data else 150
        history.append({
            "ts": timestamp.isoformat(),
            "pollution": {
                "aqius": aqi,
                "p2": aqi * 0.5,
                "p1": aqi
            }
        })
    
    return {
        "status": "success",
        "data": {
            "city": city,
            "state": state,
            "country": country,
            "current": current_data['data']['current'] if current_data else {
                "pollution": {"aqius": 150, "p2": 75, "p1": 150},
                "weather": {"tp": 25, "hu": 60}
            },
            "history": history
        }
    }

def get_leaderboard():
    """Get top cities with highest AQI"""
    try:
        cities = [
            {"city": "Delhi", "state": "Delhi", "country": "India"},
            {"city": "Mumbai", "state": "Maharashtra", "country": "India"},
            {"city": "Kolkata", "state": "West Bengal", "country": "India"},
            {"city": "Chennai", "state": "Tamil Nadu", "country": "India"},
            {"city": "Bengaluru", "state": "Karnataka", "country": "India"},
            {"city": "Hyderabad", "state": "Telangana", "country": "India"},
            {"city": "Ahmedabad", "state": "Gujarat", "country": "India"},
            {"city": "Pune", "state": "Maharashtra", "country": "India"},
            {"city": "Jaipur", "state": "Rajasthan", "country": "India"},
            {"city": "Lucknow", "state": "Uttar Pradesh", "country": "India"}
        ]
        
        leaderboard = []
        for city_data in cities:
            try:
                url = f"{BASE_URL}/city?city={city_data['city']}&state={city_data['state']}&country={city_data['country']}&key={IQAIR_API_KEY}"
                response = requests.get(url)
                if response.status_code == 200:
                    data = response.json()
                    if data.get('status') == 'success':
                        aqi = data['data']['current']['pollution']['aqius']
                        leaderboard.append({
                            "city": city_data['city'],
                            "state": city_data['state'],
                            "country": city_data['country'],
                            "aqi": aqi
                        })
            except Exception as e:
                print(f"Error fetching data for {city_data['city']}: {str(e)}")
                continue
        
        if not leaderboard:
            # If no data could be fetched, return mock data
            return create_mock_leaderboard()
        
        return sorted(leaderboard, key=lambda x: x['aqi'], reverse=True)
    except Exception as e:
        print(f"Error in get_leaderboard: {str(e)}")
        return create_mock_leaderboard()

def create_mock_leaderboard():
    """Create mock leaderboard data when API fails"""
    return [
        {"city": "Delhi", "state": "Delhi", "country": "India", "aqi": 250},
        {"city": "Beijing", "state": "Beijing", "country": "China", "aqi": 200},
        {"city": "Mumbai", "state": "Maharashtra", "country": "India", "aqi": 180},
        {"city": "Shanghai", "state": "Shanghai", "country": "China", "aqi": 160},
        {"city": "Los Angeles", "state": "California", "country": "USA", "aqi": 150}
    ]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_aqi', methods=['POST'])
def get_aqi():
    try:
        print("Received AQI request")
        data = request.json
        lat = data.get('lat')
        lon = data.get('lon')
        
        if not lat or not lon:
            print("Missing lat/lon in request")
            return jsonify({"error": "Latitude and longitude are required"}), 400
        
        print(f"Fetching AQI data for coordinates: {lat}, {lon}")
        aqi_data = get_aqi_data(lat, lon)
        
        if not aqi_data:
            print("No AQI data received")
            return jsonify({"error": "No AQI data available"}), 500
            
        if aqi_data.get('status') != 'success':
            print(f"API returned error status: {aqi_data.get('status')}")
            return jsonify({"error": "Failed to fetch AQI data"}), 500
            
        print("Successfully returning AQI data")
        return jsonify(aqi_data)
    except Exception as e:
        print(f"Error in /get_aqi endpoint: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/get_historical', methods=['POST'])
def get_historical():
    try:
        data = request.json
        city = data.get('city')
        state = data.get('state')
        country = data.get('country')
        
        if not all([city, state, country]):
            return jsonify({"error": "City, state, and country are required"}), 400
        
        historical_data = get_historical_data(city, state, country)
        return jsonify(historical_data)
    except Exception as e:
        print(f"Error in /get_historical endpoint: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/leaderboard')
def leaderboard():
    try:
        leaderboard_data = get_leaderboard()
        return jsonify(leaderboard_data)
    except Exception as e:
        print(f"Error in /leaderboard endpoint: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True) 