-- Tabel PowerStrip
CREATE TABLE PowerStrip (
    powerstripID SERIAL PRIMARY KEY,
    name TEXT,
    mac_address DOUBLE PRECISION
);

-- Tabel Outlet
CREATE TABLE Outlet (
    outletID SERIAL PRIMARY KEY,
    powerstripID INT REFERENCES PowerStrip(powerstripID) ON DELETE CASCADE,
    index INT,
    name TEXT,
    state BOOLEAN,
    timer INT,
    runtime INT
);

-- Tabel UsageLog
CREATE TABLE UsageLog (
    usageID SERIAL PRIMARY KEY,
    outletID INT REFERENCES Outlet(outletID) ON DELETE CASCADE,
    current REAL,
    power REAL,
    energy REAL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel NotificationLog
CREATE TABLE NotificationLog (
    notificationID SERIAL PRIMARY KEY,
    outletID INT REFERENCES Outlet(outletID) ON DELETE CASCADE,
    message TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel GeofenceSetting
CREATE TABLE GeofenceSetting (
    settingID SERIAL PRIMARY KEY,
    powerstripID INT REFERENCES PowerStrip(powerstripID) ON DELETE CASCADE,
    isEnabled BOOLEAN,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius INT,
    autoShutdownTime INT
);
