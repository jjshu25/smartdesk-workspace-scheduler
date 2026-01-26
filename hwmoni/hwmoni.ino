#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

int LOAD = 0;
int CPU_TEMP = 0;
int GPU_TEMP = 0;
bool has_temps = false;

// WiFi credentials
const char* ssid = "GUIA";
const char* password = "guia@alvin2002";

WebServer server(80);

// Timer variables
int timeRemaining = 0;
int totalDuration = 0;
String pcName = "";
String userName = "";
bool timerActive = false;
unsigned long lastUpdate = 0;

// ✅ NEW: Idle display variables
unsigned long lastActivityTime = 0;
const unsigned long IDLE_TIMEOUT = 5000; // 5 seconds idle before showing IDLE screen
bool isIdleMode = true;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // ✅ Initialize OLED display
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("❌ SSD1306 allocation failed");
    while (1);
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Initializing...");
  display.display();

  // Connect to WiFi
  connectToWiFi();

  // Setup web server routes
  server.on("/api/timer", HTTP_POST, handleTimerData);
  server.on("/api/timer/status", HTTP_GET, handleTimerStatus);
  server.on("/health", HTTP_GET, handleHealth);

  server.begin();
  Serial.println("✅ ESP32 Web Server started");
  Serial.print("🌐 Access at: http://");
  Serial.println(WiFi.localIP());

  // Display IP on OLED
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("WiFi Connected!");
  display.setCursor(0, 10);
  display.print("IP: ");
  display.println(WiFi.localIP());
  display.display();
  
  delay(2000);
  
  // ✅ NEW: Initialize idle display
  displayIdleScreen();
  lastActivityTime = millis();
  isIdleMode = true;
}

void loop() {
  server.handleClient();

  // ✅ UPDATED: Show idle screen if no timer is active and idle timeout reached
  if (!timerActive) {
    if (millis() - lastActivityTime > IDLE_TIMEOUT && !isIdleMode) {
      isIdleMode = true;
      displayIdleScreen();
    }
  }

  // Update display if timer is active
  if (timerActive && (millis() - lastUpdate >= 1000)) {
    lastUpdate = millis();
    timeRemaining--;

    if (timeRemaining <= 0) {
      timerActive = false;
      displayTimerEnded();
      Serial.println("⏹️ Timer ended!");
      
      // ✅ NEW: Reset to idle after timer ends
      lastActivityTime = millis();
      isIdleMode = false;
    } else {
      displayTimer();
    }
  }

  // ✅ Updated: Handle serial input for CPU/GPU temps and LOAD
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    
    if (cmd == 'L') {
      LOAD = Serial.parseInt();
    } else if (cmd == 'C') {
      CPU_TEMP = Serial.parseInt();
      has_temps = true;
    } else if (cmd == 'G') {
      GPU_TEMP = Serial.parseInt();
    }
    
    // Clear buffer
    while (Serial.available() > 0) {
      Serial.read();
    }
    
    // ✅ Update OLED display with metrics
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    
    if (has_temps) {
      // Display all three values
      display.print("CPU: ");
      display.print(CPU_TEMP);
      display.println("C");
      
      display.print("GPU: ");
      display.print(GPU_TEMP);
      display.println("C");
      
      display.print("LOAD: ");
      display.print(LOAD);
      display.println("%");
    } else {
      // Display only load if temps not available
      display.setTextSize(2);
      display.print("CPU LOAD:");
      display.setCursor(0, 20);
      display.print(LOAD);
      display.println("%");
    }
    
    display.display();
  }
}

void connectToWiFi() {
  Serial.print("🔌 Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.print("📍 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ Failed to connect to WiFi");
  }
}

void handleTimerData() {
  if (server.method() == HTTP_POST) {
    String body = server.arg("plain");
    Serial.print("📱 Received timer data: ");
    Serial.println(body);

    DynamicJsonDocument doc(256);
    DeserializationError error = deserializeJson(doc, body);

    if (error) {
      Serial.print("❌ JSON parse error: ");
      Serial.println(error.c_str());
      server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
      return;
    }

    // Extract timer data
    pcName = doc["pcName"].as<String>();
    userName = doc["userName"].as<String>();
    timeRemaining = doc["timeRemaining"].as<int>();
    totalDuration = doc["totalDuration"].as<int>();
    String status = doc["status"].as<String>();

    if (status == "started") {
      timerActive = true;
      isIdleMode = false; // ✅ NEW: Exit idle mode
      lastActivityTime = millis(); // ✅ NEW: Reset activity timer
      
      Serial.print("🎯 Timer started from PC: ");
      Serial.println(pcName);
      Serial.print("👤 User: ");
      Serial.println(userName);
      Serial.print("⏳ Duration: ");
      Serial.print(timeRemaining);
      Serial.println("s");
    } else if (status == "stopped") {
      timerActive = false;
      Serial.println("⏹️ Timer stopped");
      displayTimerEnded();
      
      // ✅ NEW: Reset to idle after stopping
      lastActivityTime = millis();
      isIdleMode = false;
    }

    displayTimer();

    // Send response
    server.send(200, "application/json", "{\"success\":true,\"message\":\"Timer received\"}");
  }
}

void handleTimerStatus() {
  DynamicJsonDocument doc(128);
  doc["timerActive"] = timerActive;
  doc["timeRemaining"] = timeRemaining;
  doc["totalDuration"] = totalDuration;
  doc["pcName"] = pcName;
  doc["userName"] = userName;
  doc["isIdle"] = isIdleMode; // ✅ NEW: Report idle status

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleHealth() {
  server.send(200, "application/json", "{\"status\":\"OK\",\"device\":\"ESP32_Timer_OLED\",\"mode\":\"" + String(isIdleMode ? "IDLE" : "ACTIVE") + "\"}");
}

// ✅ NEW: Display idle screen
void displayIdleScreen() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(20, 10);
  display.println("IDLE");
  
  display.setTextSize(1);
  display.setCursor(0, 40);
  display.println("Waiting for timer...");
  
  if (pcName.length() > 0) {
    display.setCursor(0, 50);
    display.print("PC: ");
    display.println(pcName.substring(0, 20));
  }
  
  display.display();
  
  Serial.println("🌙 Displaying IDLE screen");
}

// ✅ Updated: Display timer on OLED
void displayTimer() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  
  // Display PC name (truncate if too long)
  display.println(pcName.substring(0, 21));
  display.println("---");
  
  // Display time remaining
  display.setTextSize(2);
  display.setCursor(0, 25);
  display.println(formatTime(timeRemaining));
  
  // Display total duration
  display.setTextSize(1);
  display.setCursor(0, 45);
  display.print("Total: ");
  display.println(formatTime(totalDuration));
  
  // Display user name
  display.setCursor(0, 55);
  display.print("User: ");
  display.println(userName.substring(0, 10));
  
  display.display();

  Serial.print("📊 OLED Display: ");
  Serial.print(pcName);
  Serial.print(" - ");
  Serial.print(timeRemaining);
  Serial.println("s remaining");
}

// ✅ Updated: Display timer ended message on OLED
void displayTimerEnded() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(15, 15);
  display.println("TIME UP!");
  
  display.setTextSize(1);
  display.setCursor(20, 40);
  display.print("User: ");
  display.println(userName.substring(0, 10));
  
  display.display();
  
  // Optional: Sound a beep (if buzzer connected to pin 25)
  digitalWrite(25, HIGH);
  delay(500);
  digitalWrite(25, LOW);
  
  Serial.println("🔔 Time's up! Alarm triggered");
}

String formatTime(int seconds) {
  int mins = seconds / 60;
  int secs = seconds % 60;
  
  char timeStr[6];
  sprintf(timeStr, "%02d:%02d", mins, secs);
  return String(timeStr);
}