const int SENSOR_PIN = 8;
bool is_break = false;

void setup() {
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("---- Start sensor detection ----");
}

void loop() {
  int sensorState = digitalRead(SENSOR_PIN);

  if (sensorState == LOW && !is_break) {
    is_break = true;
    Serial.println("TRIGGERED");
  }

  if (sensorState == HIGH && is_break) {
    is_break = false;
  }
}