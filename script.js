
const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const $ = (id) => document.getElementById(id);

let temperatureChart = null;
let requestNumber = 0;
let latestWeatherData = null;
let temperatureUnit = "C";
let clockFormat = "12h";
let hourlyForecastLength = 6;
let showHourlyRainChance = false;
let favoritePlaces = [];
let comparisonRequestNumber = 0;

let activePlace = {
  name: "Ahmedabad",
  latitude: 23.0225,
  longitude: 72.5714
};

const weatherTypes = {
  0: { text: "Clear sky", icon: "☀️" },
  1: { text: "Mainly clear", icon: "🌤️" },
  2: { text: "Partly cloudy", icon: "⛅" },
  3: { text: "Overcast", icon: "☁️" },
  45: { text: "Foggy", icon: "🌫️" },
  48: { text: "Rime fog", icon: "🌫️" },
  51: { text: "Light drizzle", icon: "🌦️" },
  53: { text: "Moderate drizzle", icon: "🌦️" },
  55: { text: "Dense drizzle", icon: "🌧️" },
  56: { text: "Light freezing drizzle", icon: "🌧️" },
  57: { text: "Dense freezing drizzle", icon: "🌧️" },
  61: { text: "Light rain", icon: "🌦️" },
  63: { text: "Moderate rain", icon: "🌧️" },
  65: { text: "Heavy rain", icon: "🌧️" },
  66: { text: "Light freezing rain", icon: "🌧️" },
  67: { text: "Heavy freezing rain", icon: "🌧️" },
  71: { text: "Light snowfall", icon: "🌨️" },
  73: { text: "Moderate snowfall", icon: "❄️" },
  75: { text: "Heavy snowfall", icon: "❄️" },
  77: { text: "Snow grains", icon: "❄️" },
  80: { text: "Light rain showers", icon: "🌦️" },
  81: { text: "Moderate rain showers", icon: "🌧️" },
  82: { text: "Heavy rain showers", icon: "⛈️" },
  85: { text: "Light snow showers", icon: "🌨️" },
  86: { text: "Heavy snow showers", icon: "❄️" },
  95: { text: "Thunderstorm", icon: "⛈️" },
  96: { text: "Thunderstorm with hail", icon: "⛈️" },
  99: { text: "Severe thunderstorm with hail", icon: "⛈️" }
};

function getWeather(code) {
  return weatherTypes[code] || {
    text: "Weather unavailable",
    icon: "🌡️"
  };
}

function getWeatherVisual(weatherCode, isDay) {
  const code = Number(weatherCode);

  if ([95, 96, 99].includes(code)) {
    return { state: "stormy", icon: getWeather(code).icon };
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { state: "rainy", icon: getWeather(code).icon };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { state: "snowy", icon: getWeather(code).icon };
  }
  if ([45, 48].includes(code)) {
    return { state: "foggy", icon: getWeather(code).icon };
  }
  if ([2, 3].includes(code)) {
    return { state: "cloudy", icon: getWeather(code).icon };
  }
  if (!isDay) {
    return { state: "night", icon: "🌙" };
  }

  return { state: "sunny", icon: getWeather(code).icon };
}

function showStatus(message, type = "") {
  const status = $("status");
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function formatNumber(value, decimals = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : "--";
}

function formatTemperature(value) {
  const temperature = Number(value);
  if (!Number.isFinite(temperature)) return "--°";

  const displayedTemperature = temperatureUnit === "F"
    ? temperature * 9 / 5 + 32
    : temperature;

  return `${Math.round(displayedTemperature)}°`;
}

function formatWindSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return temperatureUnit === "F" ? "-- mph" : "-- km/h";

  const displayedSpeed = temperatureUnit === "F"
    ? speed * 0.621371
    : speed;
  const unit = temperatureUnit === "F" ? "mph" : "km/h";

  return `${formatNumber(displayedSpeed)} ${unit}`;
}

function formatTime(timeString) {
  if (!timeString) return "--:--";

  const timePart = timeString.includes("T")
    ? timeString.split("T")[1]
    : timeString;

  const [hours, minutes] = timePart.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return "--:--";
  }

  if (clockFormat === "24h") {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDate(dateString, options = {}) {
  if (!dateString) return "--";

  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-IN", options);
}

function getUVLabel(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "Unavailable";
  }

  const uv = Number(value);

  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very high";

  return "Extreme";
}

function getWindDirection(degrees) {
  if (degrees == null) return null;
  const direction = Number(degrees);
  if (!Number.isFinite(direction)) return null;

  const compassPoints = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
  ];

  return compassPoints[Math.round(((direction % 360) + 360) % 360 / 22.5) % 16];
}

function getAirQualityCategory(value) {
  const aqi = Number(value);
  if (!Number.isFinite(aqi)) return "Unavailable";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

function renderAirQualityUnavailable(message) {
  $("air-quality-label").textContent = "Air quality unavailable";
  $("air-quality-value").textContent = "AQI --";
  $("air-quality-details").textContent = message;
  $("air-quality-card").dataset.category = "unavailable";
}

async function loadAirQuality(place, currentRequest) {
  const url = new URL(AIR_QUALITY_URL);
  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "us_aqi,pm2_5,pm10",
    timezone: "auto"
  }).toString();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Air-quality service is temporarily unavailable.");
    }

    const data = await response.json();
    const current = data.current;

    if (
      !current ||
      current.us_aqi == null ||
      !Number.isFinite(Number(current.us_aqi))
    ) {
      throw new Error("No current air-quality reading is available here.");
    }

    if (
      currentRequest !== requestNumber ||
      place.latitude !== activePlace.latitude ||
      place.longitude !== activePlace.longitude
    ) {
      return;
    }

    const aqi = Math.round(Number(current.us_aqi));
    const category = getAirQualityCategory(aqi);
    const pollutants = [];

    if (current.pm2_5 != null && Number.isFinite(Number(current.pm2_5))) {
      pollutants.push(`PM2.5 ${formatNumber(current.pm2_5, 1)} μg/m³`);
    }
    if (current.pm10 != null && Number.isFinite(Number(current.pm10))) {
      pollutants.push(`PM10 ${formatNumber(current.pm10, 1)} μg/m³`);
    }

    $("air-quality-label").textContent = category;
    $("air-quality-value").textContent = `AQI ${aqi}`;
    $("air-quality-details").textContent = pollutants.length
      ? pollutants.join(" · ")
      : "Current US AQI reading.";
    $("air-quality-card").dataset.category = category.toLowerCase().replaceAll(" ", "-");
  } catch (error) {
    if (
      currentRequest !== requestNumber ||
      place.latitude !== activePlace.latitude ||
      place.longitude !== activePlace.longitude
    ) {
      return;
    }

    renderAirQualityUnavailable(
      error.message || "Could not load air-quality data."
    );
  }
}

function setLoading(isLoading) {
  $("search-btn").disabled = isLoading;
  $("location-btn").disabled = isLoading;
  $("refresh-btn").disabled = isLoading;
  $("search-btn").textContent = isLoading ? "Loading..." : "Search";
  $("refresh-btn").textContent = isLoading ? "↻ Updating..." : "↻ Refresh";
}

function initializeUnits() {
  try {
    const savedUnit = localStorage.getItem("skycast-unit");
    if (savedUnit === "C" || savedUnit === "F") {
      temperatureUnit = savedUnit;
    }

    const savedClockFormat = localStorage.getItem("skycast-clock-format");
    if (savedClockFormat === "12h" || savedClockFormat === "24h") {
      clockFormat = savedClockFormat;
    }

    const savedForecastLength = Number(localStorage.getItem("skycast-hourly-length"));
    if ([6, 12, 24].includes(savedForecastLength)) {
      hourlyForecastLength = savedForecastLength;
    }

    showHourlyRainChance =
      localStorage.getItem("skycast-hourly-rain-chance") === "true";
  } catch (error) {
    console.warn("Using default weather display preferences.");
  }

  updateUnitButton();
  updateDisplayControls();
}

function updateUnitButton() {
  const button = $("unit-toggle");
  $("chart-unit").textContent = `°${temperatureUnit}`;
  if (!latestWeatherData) {
    $("feels-like").textContent = `--°${temperatureUnit}`;
    $("wind").textContent = temperatureUnit === "F" ? "-- mph" : "-- km/h";
  }
  button.textContent = temperatureUnit === "C" ? "°C" : "°F";
  button.setAttribute(
    "aria-label",
    `Switch to ${temperatureUnit === "C" ? "Fahrenheit" : "Celsius"}`
  );
  button.setAttribute("aria-pressed", String(temperatureUnit === "F"));
}

function updateDisplayControls() {
  const clockButton = $("clock-toggle");
  clockButton.textContent = clockFormat === "12h" ? "12-hour" : "24-hour";
  clockButton.setAttribute(
    "aria-label",
    `Switch to ${clockFormat === "12h" ? "24-hour" : "12-hour"} time`
  );
  clockButton.setAttribute("aria-pressed", String(clockFormat === "24h"));
  $("forecast-hours").value = String(hourlyForecastLength);
  $("rain-chance-toggle").setAttribute(
    "aria-pressed",
    String(showHourlyRainChance)
  );
}

function readFavoritePlaces() {
  try {
    const savedPlaces = JSON.parse(localStorage.getItem("skycast-favorites") || "[]");

    if (!Array.isArray(savedPlaces)) return [];

    return savedPlaces
      .filter((place) =>
        place &&
        typeof place.name === "string" &&
        Number.isFinite(Number(place.latitude)) &&
        Number.isFinite(Number(place.longitude))
      )
      .map((place) => ({
        ...place,
        latitude: Number(place.latitude),
        longitude: Number(place.longitude)
      }));
  } catch (error) {
    console.warn("Saved cities could not be loaded.");
    return [];
  }
}

function saveFavoritePlaces() {
  try {
    localStorage.setItem("skycast-favorites", JSON.stringify(favoritePlaces));
  } catch (error) {
    showStatus("Saved cities could not be stored in this browser.", "error");
  }
}

function renderFavoritePlaces() {
  const list = $("favorite-list");
  const button = $("favorite-toggle");
  const isCurrentSaved = favoritePlaces.some((place) =>
    place.latitude === activePlace.latitude &&
    place.longitude === activePlace.longitude
  );

  button.disabled = Boolean(activePlace.isCurrentLocation);
  button.textContent = isCurrentSaved ? "★ Saved city" : "☆ Save city";
  button.setAttribute("aria-pressed", String(isCurrentSaved));
  list.replaceChildren();

  favoritePlaces.forEach((place) => {
    const cityButton = document.createElement("button");
    cityButton.type = "button";
    cityButton.className = "favorite-city";
    cityButton.textContent = place.name;
    cityButton.setAttribute("aria-label", `Show weather for ${place.name}`);
    cityButton.addEventListener("click", () => loadWeather(place));
    list.appendChild(cityButton);
  });
}

function addComparisonCard(place) {
  const card = document.createElement("article");
  card.className = "comparison-card";
  card.setAttribute("aria-label", `Weather comparison for ${place.name}`);

  const name = document.createElement("h3");
  name.textContent = place.name;
  const reading = document.createElement("p");
  reading.className = "comparison-reading";
  reading.textContent = "Loading weather...";
  const details = document.createElement("p");
  details.className = "comparison-details";

  card.append(name, reading, details);
  $("comparison-list").appendChild(card);

  return { reading, details };
}

async function showSavedCityComparison() {
  const section = $("comparison-section");
  const list = $("comparison-list");
  const request = ++comparisonRequestNumber;
  const places = favoritePlaces.slice(0, 4);

  section.hidden = false;
  list.replaceChildren();

  if (places.length === 0) {
    const message = document.createElement("p");
    message.className = "comparison-empty";
    message.textContent = "Save a city first, then compare its weather here.";
    list.appendChild(message);
    return;
  }

  const note = document.createElement("p");
  note.className = "comparison-note";
  note.textContent = places.length < favoritePlaces.length
    ? `Comparing the first ${places.length} saved cities.`
    : "Current weather in your saved cities.";
  list.appendChild(note);

  const cards = places.map((place) => ({
    place,
    elements: addComparisonCard(place)
  }));

  await Promise.all(cards.map(async ({ place, elements }) => {
    try {
      const data = await fetchWeather(place);
      if (request !== comparisonRequestNumber) return;

      const current = data.current;
      const weather = getWeather(current.weather_code);
      elements.reading.textContent =
        `${formatTemperature(current.temperature_2m)} · ${weather.text}`;
      elements.details.textContent =
        `Feels like ${formatTemperature(current.apparent_temperature)}${temperatureUnit} · ${formatWindSpeed(current.wind_speed_10m)}`;
    } catch (error) {
      if (request !== comparisonRequestNumber) return;
      elements.reading.textContent = "Weather unavailable";
      elements.details.textContent =
        error.message || "Could not load this city's weather.";
    }
  }));
}

function showExactLocation(latitude, longitude, accuracy) {
  $("place-name").textContent = "Finding nearby place...";
  $("coordinates").textContent =
    `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`;
  $("location-accuracy").textContent =
    `Device reports accuracy within about ${formatNumber(accuracy)} m`;
  $("map-link").href =
    `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}` +
    `&mlon=${encodeURIComponent(longitude)}` +
    `#map=16/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`;
  $("exact-location").hidden = false;
}

async function reverseGeocode(latitude, longitude) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "16",
    addressdetails: "1"
  }).toString();

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en"
    }
  });

  if (!response.ok) {
    throw new Error("Place name service is temporarily unavailable.");
  }

  const result = await response.json();
  const address = result.address;

  if (!address || typeof address !== "object") {
    throw new Error("No readable place name was found for this location.");
  }

  const neighborhood =
    address.neighbourhood ||
    address.suburb ||
    address.city_district ||
    address.quarter ||
    address.hamlet;
  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county;
  const placeParts = [...new Set(
    [neighborhood, locality, address.state, address.country]
      .filter((part) => typeof part === "string" && part.trim())
  )];
  const placeName = placeParts.join(", ") || result.name;

  if (typeof placeName !== "string" || !placeName.trim()) {
    throw new Error("No readable place name was found for this location.");
  }

  return placeName;
}

/* =========================
   LIGHT / DARK THEME
========================= */

const themeToggle = $("theme-toggle");
let isLightTheme = false;

function saveTheme(theme) {
  try {
    localStorage.setItem("skycast-theme", theme);
  } catch (error) {
    console.warn("Theme preference could not be saved.");
  }
}

function updateTemperatureChartTheme() {
  if (!temperatureChart) return;

  const textColor = isLightTheme ? "#53627c" : "#9ba8c2";
  const gridColor = isLightTheme
    ? "rgba(35, 50, 80, 0.10)"
    : "rgba(255, 255, 255, 0.07)";

  temperatureChart.options.scales.x.ticks.color = textColor;
  temperatureChart.options.scales.y.ticks.color = textColor;
  temperatureChart.options.scales.y.grid.color = gridColor;

  temperatureChart.update();
}

function applyTheme(theme) {
  isLightTheme = theme === "light";
  document.body.classList.toggle("light-theme", isLightTheme);

  if (themeToggle) {
    themeToggle.textContent = isLightTheme
      ? "🌙 Dark Mode"
      : "☀️ Light Mode";

    themeToggle.setAttribute(
      "aria-label",
      isLightTheme ? "Switch to dark theme" : "Switch to light theme"
    );
  }

  updateTemperatureChartTheme();
}

function initializeTheme() {
  let savedTheme = "light";

  try {
    savedTheme = localStorage.getItem("skycast-theme") || "light";
  } catch (error) {
    console.warn("Using the default light theme.");
  }

  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const nextTheme = isLightTheme ? "dark" : "light";

      applyTheme(nextTheme);
      saveTheme(nextTheme);
    });
  }
}

/* =========================
   ANIMATED WEATHER BACKGROUND
========================= */

function updateWeatherEffects(weatherCode, isDay) {
  const effects = $("weather-effects");

  if (!effects) return;

  effects.replaceChildren();

  const visual = getWeatherVisual(weatherCode, isDay);
  document.body.classList.remove(
    "weather-sunny",
    "weather-cloudy",
    "weather-rainy",
    "weather-snowy",
    "weather-stormy",
    "weather-foggy",
    "weather-night"
  );

  document.body.classList.add(`weather-${visual.state}`);
  if (!isDay && visual.state !== "night") {
    document.body.classList.add("weather-night");
  }

  if (visual.state === "snowy") {
    createParticles(effects, "snow", 25);
    return;
  }

  if (visual.state === "night") {
    createParticles(effects, "star", 28);
  }
}

function createParticles(container, type, count) {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const particle = document.createElement("span");

    const className = {
      snow: "weather-snowflake",
      star: "weather-star"
    }[type];

    particle.className = `weather-particle ${className}`;

    particle.style.setProperty(
      "--left",
      `${Math.random() * 100}%`
    );

    particle.style.setProperty("--duration", `${3 + Math.random() * 5}s`);
    particle.style.setProperty("--delay", `${-Math.random() * 8}s`);

    if (type === "snow") {
      particle.textContent = "❄";
    }

    if (type === "star") {
      particle.style.setProperty("--top", `${Math.random() * 80}%`);
    }

    fragment.appendChild(particle);
  }

  container.appendChild(fragment);
}

/* =========================
   CITY SEARCH
========================= */

async function searchCity(city) {
  const url = new URL(GEO_URL);

  url.search = new URLSearchParams({
    name: city,
    count: "1",
    language: "en",
    format: "json"
  }).toString();

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to search for this city. Try again.");
  }

  const result = await response.json();

  if (!result.results || result.results.length === 0) {
    throw new Error("City not found. Check the spelling.");
  }

  const place = result.results[0];

  return {
    name: place.name,
    country: place.country || "",
    admin1: place.admin1 || "",
    latitude: place.latitude,
    longitude: place.longitude
  };
}

/* =========================
   FETCH WEATHER DATA
========================= */

async function fetchWeather(place) {
  const url = new URL(API_BASE);

  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),

    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "dew_point_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "pressure_msl",
      "visibility",
      "wind_speed_10m",
      "wind_direction_10m",
      "uv_index"
    ].join(","),

    hourly: [
      "temperature_2m",
      "weather_code",
      "precipitation_probability"
    ].join(","),

    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "uv_index_max",
      "sunrise",
      "sunset",
      "precipitation_probability_max"
    ].join(","),

    timezone: "auto",
    forecast_days: "7",
    forecast_hours: "24"
  }).toString();

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Could not fetch weather. Please try again.");
  }

  const data = await response.json();

  if (!data.current || !data.hourly || !data.daily) {
    throw new Error("Weather data is incomplete.");
  }

  return data;
}

/* =========================
   CURRENT WEATHER
========================= */

function renderCurrentWeather(data, place) {
  const current = data.current;
  const weather = getWeather(current.weather_code);
  const visual = getWeatherVisual(current.weather_code, current.is_day);

  $("city-name").textContent = place.name;

  $("current-date").textContent = formatDate(
    current.time.split("T")[0],
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );

  $("temperature").textContent =
    formatTemperature(current.temperature_2m);

  $("weather-icon").textContent = visual.icon;
  $("weather-description").textContent = weather.text;

  $("feels-like").textContent =
    `${formatTemperature(current.apparent_temperature)}${temperatureUnit}`;

  $("day-status").textContent =
    `${current.is_day ? "Daytime" : "Nighttime"} · ${weather.text}`;

  const sidebarWeather = document.querySelector(".sidebar-weather");
  const sidebarTitle = document.querySelector(".sidebar-bottom h3");
  const sidebarCopy = document.querySelector(".sidebar-bottom p");
  const heroWeatherIcon = document.querySelector(".sun-decoration");

  if (sidebarWeather) sidebarWeather.textContent = visual.icon;
  if (sidebarTitle) sidebarTitle.textContent = `Right now in ${place.name}`;
  if (sidebarCopy) {
    sidebarCopy.textContent =
      `${weather.text} · ${formatTemperature(current.temperature_2m)}${temperatureUnit}`;
  }
  if (heroWeatherIcon) heroWeatherIcon.textContent = visual.icon;

  $("humidity").textContent =
    `${formatNumber(current.relative_humidity_2m)}%`;

  $("wind").textContent =
    formatWindSpeed(current.wind_speed_10m);

  const windDirection = getWindDirection(current.wind_direction_10m);
  $("wind-direction").textContent = windDirection || "--";
  $("wind-bearing").textContent = current.wind_direction_10m != null &&
    Number.isFinite(Number(current.wind_direction_10m))
    ? `${Math.round(Number(current.wind_direction_10m))}° from north`
    : "Direction unavailable";

  $("uv").textContent = formatNumber(current.uv_index, 1);
  $("uv-label").textContent = getUVLabel(current.uv_index);

  const rainProbability = data.daily.precipitation_probability_max?.[0];

  $("rain").textContent = rainProbability == null
    ? "--%"
    : `${rainProbability}%`;

  $("pressure").textContent = Number.isFinite(Number(current.pressure_msl))
    ? `${formatNumber(current.pressure_msl)} hPa`
    : "-- hPa";

  const visibilityMeters = Number(current.visibility);
  $("visibility").textContent = Number.isFinite(visibilityMeters)
    ? visibilityMeters < 1000
      ? `${formatNumber(visibilityMeters)} m`
      : `${formatNumber(visibilityMeters / 1000, 1)} km`
    : "-- km";

  $("dew-point").textContent =
    `${formatTemperature(current.dew_point_2m)}${temperatureUnit}`;

  updateWeatherEffects(current.weather_code, current.is_day);
}

function renderDailyAdvice(data) {
  const current = data.current;
  const temperature = Number(current.temperature_2m);
  const precipitation = Number(data.daily.precipitation_probability_max?.[0]);
  const uv = Number(data.daily.uv_index_max?.[0] ?? current.uv_index);
  const weatherCode = Number(current.weather_code);
  const suggestions = [];

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    suggestions.push("Wear a warm, waterproof outer layer for snow.");
  } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
    suggestions.push("Take a waterproof jacket or umbrella.");
  } else if (temperature <= 8) {
    suggestions.push("A warm coat and extra layers should help in the cold.");
  } else if (temperature <= 17) {
    suggestions.push("Bring a light jacket or a comfortable extra layer.");
  } else if (temperature >= 30) {
    suggestions.push("Choose light, breathable clothing for the heat.");
  } else {
    suggestions.push("Light, comfortable layers should suit today's temperature.");
  }

  if (Number.isFinite(precipitation) && precipitation >= 40 &&
      ![51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
    suggestions.push("Rain is possible, so consider carrying an umbrella.");
  }
  if (Number.isFinite(uv) && uv >= 5 && current.is_day) {
    suggestions.push("UV is elevated; sunglasses and sun protection are a good idea.");
  }

  $("outfit-suggestion").textContent = suggestions.join(" ");
}

function renderWeatherHeadsUp(data) {
  const current = data.current;
  const alerts = [];
  const temperature = Number(current.temperature_2m);
  const windSpeed = Number(current.wind_speed_10m);
  const uv = Number(data.daily.uv_index_max?.[0] ?? current.uv_index);
  const precipitation = Number(data.daily.precipitation_probability_max?.[0]);
  const weatherCode = Number(current.weather_code);

  if ([95, 96, 99].includes(weatherCode)) {
    alerts.push("Thunderstorms are indicated in the current conditions; consider delaying outdoor plans.");
  }
  if (Number.isFinite(precipitation) && precipitation >= 60) {
    alerts.push(`Rain is likely today (${Math.round(precipitation)}% chance).`);
  }
  if (Number.isFinite(temperature) && temperature >= 35) {
    alerts.push(`High heat expected (${formatTemperature(temperature)}${temperatureUnit}); drink water and limit strenuous outdoor activity.`);
  } else if (Number.isFinite(temperature) && temperature <= 0) {
    alerts.push(`Freezing conditions (${formatTemperature(temperature)}${temperatureUnit}); watch for icy surfaces.`);
  }
  if (Number.isFinite(windSpeed) && windSpeed >= 40) {
    alerts.push(`Strong winds around ${formatWindSpeed(windSpeed)} may affect outdoor plans.`);
  }
  if (Number.isFinite(uv) && uv >= 8 && current.is_day) {
    alerts.push(`Very high UV index (${formatNumber(uv, 1)}); seek shade and use sun protection.`);
  }

  const list = $("weather-alerts");
  list.replaceChildren();

  if (alerts.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No notable weather concerns in the current forecast.";
    list.appendChild(item);
    return;
  }

  alerts.forEach((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    list.appendChild(item);
  });
}

function timeToMinutes(timeString) {
  if (typeof timeString !== "string") return null;
  const match = timeString.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function renderDaylight(data) {
  const sunrise = timeToMinutes(data.daily.sunrise?.[0]);
  const sunset = timeToMinutes(data.daily.sunset?.[0]);
  const progress = $("daylight-progress");
  const fill = $("daylight-progress-fill");

  if (sunrise === null || sunset === null || sunset <= sunrise) {
    $("daylight-remaining").textContent = "Daylight times unavailable";
    $("daylight-progress-label").textContent = "No daylight progress data available.";
    progress.setAttribute("aria-valuenow", "0");
    fill.style.width = "0%";
    return;
  }

  const offsetSeconds = Number(data.utc_offset_seconds);
  const localNow = new Date(
    Date.now() + (Number.isFinite(offsetSeconds) ? offsetSeconds * 1000 : 0)
  );
  const currentMinutes = Number.isFinite(offsetSeconds)
    ? localNow.getUTCHours() * 60 + localNow.getUTCMinutes()
    : timeToMinutes(data.current.time);

  if (currentMinutes === null) {
    $("daylight-remaining").textContent = "Daylight progress unavailable";
    $("daylight-progress-label").textContent = "Current local time is unavailable.";
    progress.setAttribute("aria-valuenow", "0");
    fill.style.width = "0%";
    return;
  }

  const totalDaylight = sunset - sunrise;
  const elapsed = Math.max(0, Math.min(totalDaylight, currentMinutes - sunrise));
  const percent = Math.round(elapsed / totalDaylight * 100);
  const remaining = Math.max(0, sunset - currentMinutes);
  const remainingLabel = `${Math.floor(remaining / 60)}h ${remaining % 60}m daylight remaining`;

  if (currentMinutes < sunrise) {
    $("daylight-remaining").textContent = `Sunrise at ${formatTime(data.daily.sunrise[0])}`;
  } else if (currentMinutes >= sunset) {
    $("daylight-remaining").textContent = `Daylight ended at ${formatTime(data.daily.sunset[0])}`;
  } else {
    $("daylight-remaining").textContent = remainingLabel;
  }

  $("daylight-progress-label").textContent =
    `${percent}% of today's daylight elapsed · ${Math.floor(totalDaylight / 60)}h ${totalDaylight % 60}m total`;
  progress.setAttribute("aria-valuenow", String(percent));
  fill.style.width = `${percent}%`;
}

/* =========================
   HOURLY FORECAST
========================= */

function renderHourly(data) {
  const hourly = data.hourly;
  const list = $("hourly-list");

  list.replaceChildren();

  let startIndex = hourly.time.findIndex(
    (time) => time >= data.current.time
  );

  if (startIndex < 0) startIndex = 0;

  const endIndex = Math.min(
    startIndex + hourlyForecastLength,
    hourly.time.length
  );

  for (let i = startIndex; i < endIndex; i++) {
    const weather = getWeather(hourly.weather_code[i]);

    const item = document.createElement("article");
    item.className = "hourly-item";

    const time = document.createElement("p");
    time.className = "hourly-time";
    time.textContent =
      i === startIndex ? "Now" : formatTime(hourly.time[i]);

    const icon = document.createElement("div");
    icon.className = "hourly-icon";
    icon.textContent = weather.icon;

    const temp = document.createElement("p");
    temp.className = "hourly-temp";
    temp.textContent = formatTemperature(hourly.temperature_2m[i]);

    item.append(time, icon, temp);

    const rainChance = hourly.precipitation_probability?.[i];
    if (showHourlyRainChance && rainChance != null) {
      const rain = document.createElement("p");
      rain.className = "hourly-rain";
      rain.textContent = `💧 ${formatNumber(rainChance)}%`;
      item.appendChild(rain);
    }

    list.appendChild(item);
  }
}

/* =========================
   SEVEN-DAY FORECAST
========================= */

function renderForecast(data) {
  const daily = data.daily;
  const list = $("forecast-list");

  list.replaceChildren();

  daily.time.forEach((date, i) => {
    const weather = getWeather(daily.weather_code[i]);

    const row = document.createElement("div");
    row.className = "forecast-row";

    const day = document.createElement("p");
    day.className = "forecast-day";
    day.textContent = i === 0
      ? "Today"
      : formatDate(date, { weekday: "short" });

    const condition = document.createElement("div");
    condition.className = "forecast-condition";

    const icon = document.createElement("span");
    icon.textContent = weather.icon;

    const description = document.createElement("span");
    description.textContent = weather.text;

    condition.append(icon, description);

    const temperatures = document.createElement("div");
    temperatures.className = "forecast-temps";

    const max = document.createElement("span");
    max.className = "forecast-max";
    max.textContent = formatTemperature(daily.temperature_2m_max[i]);

    const min = document.createElement("span");
    min.className = "forecast-min";
    min.textContent = formatTemperature(daily.temperature_2m_min[i]);

    temperatures.append(max, min);

    const rain = document.createElement("p");
    rain.className = "forecast-rain";

    const probability = daily.precipitation_probability_max?.[i];

    rain.textContent = probability == null
      ? "--"
      : `💧 ${probability}%`;

    row.append(day, condition, temperatures, rain);
    list.appendChild(row);
  });
}

/* =========================
   SUNRISE AND SUNSET
========================= */

function renderSunTimes(data) {
  $("sunrise").textContent = formatTime(data.daily.sunrise?.[0]);
  $("sunset").textContent = formatTime(data.daily.sunset?.[0]);
}

/* =========================
   TEMPERATURE CHART
========================= */

function renderTemperatureChart(data) {
  const hourly = data.hourly;

  let startIndex = hourly.time.findIndex(
    (time) => time >= data.current.time
  );

  if (startIndex < 0) startIndex = 0;

  const endIndex = Math.min(startIndex + 24, hourly.time.length);

  const labels = [];
  const temperatures = [];

  for (let i = startIndex; i < endIndex; i++) {
    labels.push(formatTime(hourly.time[i]));
    const temperature = Number(hourly.temperature_2m[i]);
    temperatures.push(temperatureUnit === "F"
      ? temperature * 9 / 5 + 32
      : temperature);
  }

  if (temperatureChart) {
    temperatureChart.destroy();
    temperatureChart = null;
  }

  if (typeof Chart === "undefined") {
    $("chart-status").textContent =
      "Chart library did not load. Check your internet connection.";
    return;
  }

  const canvas = $("tempChart");
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, "rgba(138, 170, 255, 0.35)");
  gradient.addColorStop(1, "rgba(138, 170, 255, 0.01)");

  const textColor = isLightTheme ? "#53627c" : "#9ba8c2";
  const gridColor = isLightTheme
    ? "rgba(35, 50, 80, 0.10)"
    : "rgba(255, 255, 255, 0.07)";

  temperatureChart = new Chart(canvas, {
    type: "line",

    data: {
      labels,
      datasets: [{
        label: "Temperature",
        data: temperatures,
        borderColor: "#8aaaff",
        backgroundColor: gradient,
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 6,
        pointBackgroundColor: "#dce7ff",
        pointBorderColor: "#8aaaff"
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          callbacks: {
            label: (context) => `${Math.round(context.parsed.y)}°${temperatureUnit}`
          }
        }
      },

      scales: {
        x: {
          ticks: {
            color: textColor,
            maxTicksLimit: 8,
            maxRotation: 0
          },
          grid: {
            display: false
          },
          border: {
            display: false
          }
        },

        y: {
          ticks: {
            color: textColor,
            callback: (value) => `${value}°`
          },
          grid: {
            color: gridColor
          },
          border: {
            display: false
          }
        }
      }
    }
  });

  $("chart-status").textContent =
    "Temperature forecast for the next 24 hours.";
}

/* =========================
   RENDER ALL WEATHER SECTIONS
========================= */

function renderAllWeather(data, place) {
  renderCurrentWeather(data, place);
  renderDailyAdvice(data);
  renderWeatherHeadsUp(data);
  renderDaylight(data);
  renderHourly(data);
  renderForecast(data);
  renderSunTimes(data);
  renderTemperatureChart(data);
}

function refreshAirQuality(place, currentRequest) {
  renderAirQualityUnavailable("Fetching nearby air-quality readings.");
  loadAirQuality(place, currentRequest);
}

/* =========================
   SEARCH AND LOAD CITY
========================= */

async function loadWeather(city) {
  const currentRequest = ++requestNumber;
  const cityName = typeof city === "string" ? city : city.name;

  setLoading(true);
  showStatus(`Loading weather for ${cityName}...`);

  try {
    const place = typeof city === "string" ? await searchCity(city) : city;

    if (currentRequest !== requestNumber) return;

    const data = await fetchWeather(place);

    if (currentRequest !== requestNumber) return;

    activePlace = place;
    $("city-input").value = place.name;
    latestWeatherData = data;

    renderAllWeather(data, place);
    renderFavoritePlaces();
    refreshAirQuality(place, currentRequest);

    const details = [place.admin1, place.country]
      .filter(Boolean)
      .join(", ");

    showStatus(
      `Weather updated for ${place.name}${details ? `, ${details}` : ""}.`,
      "success"
    );
  } catch (error) {
    if (currentRequest !== requestNumber) return;

    showStatus(
      error.message || "Something went wrong. Please try again.",
      "error"
    );
  } finally {
    if (currentRequest === requestNumber) {
      setLoading(false);
    }
  }
}

/* =========================
   CURRENT LOCATION
========================= */

function loadCurrentLocation() {
  if (!navigator.geolocation) {
    showStatus(
      "Location is not supported by your browser. Search for a city instead.",
      "error"
    );
    return;
  }

  const currentRequest = ++requestNumber;

  setLoading(true);
  showStatus("Requesting your location...");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (currentRequest !== requestNumber) return;

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(position.coords.accuracy) ||
        position.coords.accuracy < 0 ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        showStatus("Your location coordinates are invalid.", "error");
        setLoading(false);
        return;
      }

      showExactLocation(
        latitude,
        longitude,
        position.coords.accuracy
      );
      reverseGeocode(latitude, longitude).then(
        (placeName) => {
          if (currentRequest === requestNumber) {
            $("place-name").textContent = placeName;
          }
        },
        (error) => {
          if (currentRequest === requestNumber) {
            $("place-name").textContent =
              error.message || "Place name is unavailable.";
          }
        }
      );

      const place = {
        name: "Your Location",
        latitude,
        longitude,
        isCurrentLocation: true
      };

      try {
        showStatus("Loading weather for your location...");

        const data = await fetchWeather(place);

        if (currentRequest !== requestNumber) return;

        activePlace = place;
        $("city-input").value = "";
        latestWeatherData = data;

        renderAllWeather(data, place);
        renderFavoritePlaces();
        refreshAirQuality(place, currentRequest);

        showStatus(
          "Weather for your current location is updated.",
          "success"
        );
      } catch (error) {
        if (currentRequest !== requestNumber) return;

        showStatus(
          error.message || "Could not load local weather.",
          "error"
        );
      } finally {
        if (currentRequest === requestNumber) {
          setLoading(false);
        }
      }
    },

    (error) => {
      if (currentRequest !== requestNumber) return;

      let message = "Could not get your location.";

      if (error.code === 1) {
        message =
          "Location permission denied. Allow location access in your browser.";
      } else if (error.code === 2) {
        message =
          "Your location is unavailable. Search for a city instead.";
      } else if (error.code === 3) {
        message = "Location request timed out. Please try again.";
      }

      showStatus(message, "error");
      setLoading(false);
    },

    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}

/* =========================
   EVENT LISTENERS
========================= */

$("search-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const city = $("city-input").value.trim();

  if (!city) {
    showStatus("Please enter a city name.", "error");
    return;
  }

  loadWeather(city);
});

$("location-btn").addEventListener("click", () => {
  loadCurrentLocation();
});

$("unit-toggle").addEventListener("click", () => {
  temperatureUnit = temperatureUnit === "C" ? "F" : "C";

  try {
    localStorage.setItem("skycast-unit", temperatureUnit);
  } catch (error) {
    console.warn("Temperature unit preference could not be saved.");
  }

  updateUnitButton();

  if (latestWeatherData) {
    renderAllWeather(latestWeatherData, activePlace);
  }
});

$("clock-toggle").addEventListener("click", () => {
  clockFormat = clockFormat === "12h" ? "24h" : "12h";

  try {
    localStorage.setItem("skycast-clock-format", clockFormat);
  } catch (error) {
    console.warn("Time format preference could not be saved.");
  }

  updateDisplayControls();

  if (latestWeatherData) {
    renderAllWeather(latestWeatherData, activePlace);
  }
});

$("forecast-hours").addEventListener("change", (event) => {
  const selectedLength = Number(event.target.value);
  if (![6, 12, 24].includes(selectedLength)) return;

  hourlyForecastLength = selectedLength;

  try {
    localStorage.setItem("skycast-hourly-length", String(hourlyForecastLength));
  } catch (error) {
    console.warn("Hourly forecast preference could not be saved.");
  }

  if (latestWeatherData) {
    renderHourly(latestWeatherData);
  }
});

$("rain-chance-toggle").addEventListener("click", () => {
  showHourlyRainChance = !showHourlyRainChance;
  updateDisplayControls();

  try {
    localStorage.setItem(
      "skycast-hourly-rain-chance",
      String(showHourlyRainChance)
    );
  } catch (error) {
    console.warn("Rain chance display preference could not be saved.");
  }

  if (latestWeatherData) {
    renderHourly(latestWeatherData);
  }
});

$("refresh-btn").addEventListener("click", async () => {
  const currentRequest = ++requestNumber;
  const place = { ...activePlace };

  setLoading(true);
  showStatus(`Refreshing weather for ${place.name}...`);

  try {
    const data = await fetchWeather(place);

    if (currentRequest !== requestNumber) return;

    latestWeatherData = data;
    renderAllWeather(data, place);
    refreshAirQuality(place, currentRequest);
    showStatus(`Weather refreshed for ${place.name}.`, "success");
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    showStatus(error.message || "Could not refresh weather.", "error");
  } finally {
    if (currentRequest === requestNumber) {
      setLoading(false);
    }
  }
});

$("favorite-toggle").addEventListener("click", () => {
  if (activePlace.isCurrentLocation) return;

  const existingIndex = favoritePlaces.findIndex((place) =>
    place.latitude === activePlace.latitude &&
    place.longitude === activePlace.longitude
  );

  if (existingIndex >= 0) {
    favoritePlaces.splice(existingIndex, 1);
  } else {
    favoritePlaces.unshift({
      name: activePlace.name,
      latitude: activePlace.latitude,
      longitude: activePlace.longitude
    });
  }

  saveFavoritePlaces();
  renderFavoritePlaces();
});

$("compare-cities-btn").addEventListener("click", () => {
  showSavedCityComparison();
});

$("close-comparison").addEventListener("click", () => {
  comparisonRequestNumber++;
  $("comparison-section").hidden = true;
});

/* =========================
   AUTO-REFRESH EVERY 10 MINUTES
========================= */

setInterval(async () => {
  if (document.hidden) return;

  const place = { ...activePlace };

  try {
    const data = await fetchWeather(place);

    // Don't overwrite a newer city selection.
    if (
      place.latitude !== activePlace.latitude ||
      place.longitude !== activePlace.longitude
    ) {
      return;
    }

    latestWeatherData = data;
    renderAllWeather(data, place);
    refreshAirQuality(place, requestNumber);
    showStatus(`Weather refreshed for ${place.name}.`, "success");
  } catch (error) {
    console.error("Automatic weather refresh failed:", error);
  }
}, 10 * 60 * 1000);

setInterval(() => {
  if (latestWeatherData && !document.hidden) {
    renderDaylight(latestWeatherData);
  }
}, 60 * 1000);

/* =========================
   START DASHBOARD
========================= */

initializeTheme();
initializeUnits();
favoritePlaces = readFavoritePlaces();
renderFavoritePlaces();
loadWeather("Ahmedabad");
