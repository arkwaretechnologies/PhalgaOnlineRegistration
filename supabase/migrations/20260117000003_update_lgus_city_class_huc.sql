-- Migration: Update city_class to 'HUC' for specific PSGC codes
-- Updates the city_class column for Highly Urbanized Cities

-- Add city_class column if it doesn't exist (in case this runs before the CC migration)
ALTER TABLE lgus 
ADD COLUMN IF NOT EXISTS city_class VARCHAR(10);

-- Update city_class to 'HUC' for the specified PSGC codes
UPDATE lgus
SET city_class = 'HUC'
WHERE psgc IN (
    '1380100000',
    '1380200000',
    '1380300000',
    '1380400000',
    '1380500000',
    '1380600000',
    '1380700000',
    '1380800000',
    '1380900000',
    '1381000000',
    '1381100000',
    '1381200000',
    '1381300000',
    '1381400000',
    '1381500000',
    '1381600000',
    '1430300000',
    '0330100000',
    '0331400000',
    '0431200000',
    '1731500000',
    '0631000000',
    '1830200000',
    '0730600000',
    '0731100000',
    '0731300000',
    '0831600000',
    '0931700000',
    '1030500000',
    '1030900000',
    '1130700000',
    '1230800000',
    '1630400000'
);
